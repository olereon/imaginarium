#!/bin/bash

# Migration Deployment Script
# This script handles automated migration deployment across environments

set -e

echo "🚀 Starting migration deployment process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="deployment_${TIMESTAMP}.log"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
DEPLOYMENT_TIMEOUT=300  # 5 minutes

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" >> "$LOG_FILE"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1" >> "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1" >> "$LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" >> "$LOG_FILE"
}

# Function to send Slack notification
send_slack_notification() {
    local message="$1"
    local color="${2:-good}"
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking deployment prerequisites..."
    
    # Check environment variables
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    if [ -z "$ENVIRONMENT" ]; then
        print_error "ENVIRONMENT environment variable is not set"
        exit 1
    fi
    
    # Check if prisma is available
    if ! command -v npx &> /dev/null; then
        print_error "npx is not installed"
        exit 1
    fi
    
    # Check if schema exists
    if [ ! -f "prisma/schema.prisma" ]; then
        print_error "prisma/schema.prisma not found"
        exit 1
    fi
    
    # Check if migrations directory exists
    if [ ! -d "prisma/migrations" ]; then
        print_error "prisma/migrations directory not found"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to validate migrations
validate_migrations() {
    print_status "Validating migrations..."
    
    # Validate Prisma schema
    if npx prisma validate; then
        print_success "Prisma schema validation passed"
    else
        print_error "Prisma schema validation failed"
        return 1
    fi
    
    # Check migration naming conventions
    for dir in prisma/migrations/*/; do
        if [ -d "$dir" ]; then
            dirname=$(basename "$dir")
            
            # Check if directory name matches pattern: YYYYMMDDHHMMSS_description
            if [[ ! "$dirname" =~ ^[0-9]{14}_[a-z0-9_]+$ ]]; then
                print_error "Migration directory '$dirname' does not follow naming convention"
                return 1
            fi
        fi
    done
    
    print_success "Migration validation passed"
}

# Function to run pre-deployment tests
run_pre_deployment_tests() {
    print_status "Running pre-deployment tests..."
    
    # Create test database
    local test_db_url="file:./test_deployment_${TIMESTAMP}.db"
    local original_db_url="$DATABASE_URL"
    
    export DATABASE_URL="$test_db_url"
    
    # Run migration tests
    if timeout "$DEPLOYMENT_TIMEOUT" ./scripts/test-migration.sh forward; then
        print_success "Pre-deployment tests passed"
    else
        print_error "Pre-deployment tests failed"
        export DATABASE_URL="$original_db_url"
        return 1
    fi
    
    # Cleanup test database
    rm -f "./test_deployment_${TIMESTAMP}.db"
    export DATABASE_URL="$original_db_url"
}

# Function to create deployment backup
create_deployment_backup() {
    print_status "Creating deployment backup..."
    
    # Use the production migration script to create backup
    if ./scripts/migrate-prod.sh backup; then
        print_success "Deployment backup created"
    else
        print_error "Failed to create deployment backup"
        return 1
    fi
}

# Function to deploy migrations
deploy_migrations() {
    print_status "Deploying migrations to $ENVIRONMENT environment..."
    
    local start_time=$(date +%s)
    
    # Deploy based on environment
    if [ "$ENVIRONMENT" == "development" ]; then
        # Development deployment
        if ./scripts/migrate-dev.sh generate; then
            print_success "Development migration completed"
        else
            print_error "Development migration failed"
            return 1
        fi
    else
        # Production/staging deployment
        if timeout "$DEPLOYMENT_TIMEOUT" ./scripts/migrate-prod.sh deploy; then
            print_success "Production migration completed"
        else
            print_error "Production migration failed"
            return 1
        fi
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    print_success "Migration deployment completed in ${duration} seconds"
}

# Function to run post-deployment tests
run_post_deployment_tests() {
    print_status "Running post-deployment tests..."
    
    # Check migration status
    if npx prisma migrate status; then
        print_success "Migration status check passed"
    else
        print_error "Migration status check failed"
        return 1
    fi
    
    # Generate Prisma client
    if npx prisma generate; then
        print_success "Prisma client generated successfully"
    else
        print_error "Failed to generate Prisma client"
        return 1
    fi
    
    # Run basic connection test
    if timeout 30 node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.\$connect()
          .then(() => {
            console.log('Database connection successful');
            process.exit(0);
          })
          .catch((error) => {
            console.error('Database connection failed:', error);
            process.exit(1);
          });
    "; then
        print_success "Database connection test passed"
    else
        print_error "Database connection test failed"
        return 1
    fi
}

# Function to rollback on failure
rollback_deployment() {
    print_status "Rolling back deployment..."
    
    # Find the most recent backup
    local backup_dir
    if [ "$ENVIRONMENT" == "development" ]; then
        backup_dir="prisma/backups"
    else
        backup_dir="backups"
    fi
    
    local latest_backup=$(find "$backup_dir" -name "backup_*" -type f | sort -r | head -n 1)
    
    if [ -n "$latest_backup" ]; then
        print_status "Found backup: $latest_backup"
        
        if ./scripts/rollback.sh restore "$latest_backup"; then
            print_success "Rollback completed successfully"
        else
            print_error "Rollback failed"
            return 1
        fi
    else
        print_error "No backup found for rollback"
        return 1
    fi
}

# Function to cleanup after deployment
cleanup_deployment() {
    print_status "Cleaning up deployment artifacts..."
    
    # Remove old backups (keep last 10)
    if [ "$ENVIRONMENT" != "development" ]; then
        ./scripts/migrate-prod.sh cleanup || true
    fi
    
    # Remove temporary files
    rm -f test_deployment_*.db
    
    print_success "Cleanup completed"
}

# Function to generate deployment report
generate_deployment_report() {
    print_status "Generating deployment report..."
    
    local report_file="deployment_report_${TIMESTAMP}.json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "database_url": "${DATABASE_URL%%@*}@***",
  "deployment_duration": "$(($(date +%s) - deployment_start_time))",
  "status": "success",
  "migrations_applied": $(npx prisma migrate status --json 2>/dev/null | jq '.appliedMigrations | length' || echo 0),
  "schema_version": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "deployer": "$(whoami)",
  "log_file": "$LOG_FILE"
}
EOF
    
    print_success "Deployment report generated: $report_file"
}

# Function to show help
show_help() {
    echo "Migration Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy           Deploy migrations to target environment"
    echo "  rollback         Rollback to previous version"
    echo "  status           Show deployment status"
    echo "  help             Show this help message"
    echo ""
    echo "Options:"
    echo "  --dry-run        Show what would be deployed without executing"
    echo "  --skip-tests     Skip pre and post deployment tests"
    echo "  --force          Force deployment even if tests fail"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL     Database connection string (required)"
    echo "  ENVIRONMENT      Target environment (development/staging/production)"
    echo "  SLACK_WEBHOOK_URL Slack webhook for notifications (optional)"
    echo ""
    echo "Examples:"
    echo "  ENVIRONMENT=staging $0 deploy"
    echo "  ENVIRONMENT=production $0 deploy --dry-run"
    echo "  ENVIRONMENT=production $0 rollback"
}

# Function to perform dry run
perform_dry_run() {
    print_status "Performing dry run deployment..."
    
    echo "Deployment would perform the following actions:"
    echo "1. Validate migrations"
    echo "2. Run pre-deployment tests"
    echo "3. Create deployment backup"
    echo "4. Deploy migrations to $ENVIRONMENT"
    echo "5. Run post-deployment tests"
    echo "6. Generate deployment report"
    echo ""
    
    # Show what migrations would be applied
    print_status "Migrations that would be applied:"
    npx prisma migrate status
    
    print_success "Dry run completed"
}

# Function to show deployment status
show_deployment_status() {
    print_status "Current deployment status:"
    
    echo "Environment: $ENVIRONMENT"
    echo "Database URL: ${DATABASE_URL%%@*}@***"
    echo ""
    
    # Show migration status
    npx prisma migrate status
    
    # Show recent deployments
    if [ -f "deployment_history.log" ]; then
        echo ""
        echo "Recent deployments:"
        tail -n 10 deployment_history.log
    fi
}

# Function to log deployment
log_deployment() {
    local status="$1"
    
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $ENVIRONMENT deployment: $status" >> deployment_history.log
    echo "  Database: ${DATABASE_URL%%@*}@***" >> deployment_history.log
    echo "  User: $(whoami)" >> deployment_history.log
    echo "  Commit: $(git rev-parse HEAD 2>/dev/null || echo 'unknown')" >> deployment_history.log
    echo "" >> deployment_history.log
}

# Main deployment function
main_deploy() {
    local skip_tests=false
    local force=false
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-tests)
                skip_tests=true
                shift
                ;;
            --force)
                force=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    deployment_start_time=$(date +%s)
    
    print_status "Starting deployment to $ENVIRONMENT environment"
    send_slack_notification "🚀 Starting migration deployment to $ENVIRONMENT" "warning"
    
    # Check prerequisites
    check_prerequisites
    
    # Validate migrations
    validate_migrations
    
    # Run pre-deployment tests
    if [ "$skip_tests" = false ]; then
        if ! run_pre_deployment_tests; then
            if [ "$force" = false ]; then
                print_error "Pre-deployment tests failed. Use --force to override."
                log_deployment "FAILED (pre-tests)"
                send_slack_notification "❌ Migration deployment failed: pre-deployment tests" "danger"
                exit 1
            else
                print_warning "Pre-deployment tests failed but continuing due to --force"
            fi
        fi
    fi
    
    # Create backup (except for development)
    if [ "$ENVIRONMENT" != "development" ]; then
        create_deployment_backup
    fi
    
    # Deploy migrations
    if deploy_migrations; then
        print_success "Migration deployment successful"
    else
        print_error "Migration deployment failed"
        
        # Attempt rollback
        if [ "$ENVIRONMENT" != "development" ]; then
            print_status "Attempting automatic rollback..."
            if rollback_deployment; then
                print_success "Rollback completed"
                log_deployment "FAILED (rolled back)"
                send_slack_notification "🔄 Migration deployment failed and rolled back" "warning"
            else
                print_error "Rollback failed - manual intervention required"
                log_deployment "FAILED (rollback failed)"
                send_slack_notification "🚨 Migration deployment and rollback failed - manual intervention required" "danger"
            fi
        else
            log_deployment "FAILED"
            send_slack_notification "❌ Migration deployment failed in development" "danger"
        fi
        
        exit 1
    fi
    
    # Run post-deployment tests
    if [ "$skip_tests" = false ]; then
        if ! run_post_deployment_tests; then
            if [ "$force" = false ]; then
                print_error "Post-deployment tests failed. Consider rollback."
                log_deployment "FAILED (post-tests)"
                send_slack_notification "❌ Migration deployment failed: post-deployment tests" "danger"
                exit 1
            else
                print_warning "Post-deployment tests failed but continuing due to --force"
            fi
        fi
    fi
    
    # Generate deployment report
    generate_deployment_report
    
    # Cleanup
    cleanup_deployment
    
    # Log successful deployment
    log_deployment "SUCCESS"
    send_slack_notification "✅ Migration deployment to $ENVIRONMENT completed successfully" "good"
    
    print_success "Deployment completed successfully!"
}

# Main script logic
case "$1" in
    deploy)
        if [ "$2" = "--dry-run" ]; then
            perform_dry_run
        else
            shift
            main_deploy "$@"
        fi
        ;;
    rollback)
        if [ "$ENVIRONMENT" != "development" ]; then
            rollback_deployment
        else
            print_error "Rollback not supported in development environment"
            exit 1
        fi
        ;;
    status)
        show_deployment_status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac

print_success "Deployment script completed!"