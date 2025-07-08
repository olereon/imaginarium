#!/bin/bash

# Production Migration Script
# This script handles database migrations for production environment

set -e

echo "🚀 Starting production migration process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="migration_${TIMESTAMP}.log"
MAINTENANCE_FILE="maintenance.html"

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

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if we're in the right directory
    if [ ! -f "prisma/schema.prisma" ]; then
        print_error "prisma/schema.prisma not found. Are you in the project root?"
        exit 1
    fi
    
    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    # Check if backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        print_warning "Backup directory does not exist, creating it..."
        mkdir -p "$BACKUP_DIR"
    fi
    
    # Check if prisma is installed
    if ! command -v npx &> /dev/null; then
        print_error "npx is not installed"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to create database backup
create_backup() {
    print_status "Creating database backup..."
    
    # For PostgreSQL
    if [[ "$DATABASE_URL" == *"postgresql"* ]]; then
        backup_file="$BACKUP_DIR/backup_prod_$TIMESTAMP.sql"
        
        # Extract database info from URL
        db_url_without_protocol="${DATABASE_URL#*://}"
        db_credentials="${db_url_without_protocol%%@*}"
        db_host_and_db="${db_url_without_protocol#*@}"
        db_host="${db_host_and_db%%/*}"
        db_name="${db_host_and_db##*/}"
        
        # Create backup
        if PGPASSWORD="${db_credentials#*:}" pg_dump -h "${db_host%%:*}" -p "${db_host##*:}" -U "${db_credentials%%:*}" -d "$db_name" > "$backup_file"; then
            print_success "PostgreSQL backup created: $backup_file"
        else
            print_error "Failed to create PostgreSQL backup"
            exit 1
        fi
    
    # For SQLite
    elif [[ "$DATABASE_URL" == *"sqlite"* ]] || [[ "$DATABASE_URL" == *"file:"* ]]; then
        db_file="${DATABASE_URL#*:}"
        backup_file="$BACKUP_DIR/backup_prod_$TIMESTAMP.db"
        
        if [ -f "$db_file" ]; then
            cp "$db_file" "$backup_file"
            print_success "SQLite backup created: $backup_file"
        else
            print_error "Database file not found: $db_file"
            exit 1
        fi
    
    else
        print_error "Unsupported database type in DATABASE_URL"
        exit 1
    fi
}

# Function to enable maintenance mode
enable_maintenance() {
    print_status "Enabling maintenance mode..."
    
    # Create maintenance page
    cat > "$MAINTENANCE_FILE" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Maintenance Mode</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚧 Maintenance Mode</h1>
        <p>We're currently performing database maintenance to improve your experience.</p>
        <p>Please check back in a few minutes.</p>
        <p>Thank you for your patience!</p>
    </div>
</body>
</html>
EOF
    
    # Signal application to enter maintenance mode
    touch ".maintenance"
    
    print_success "Maintenance mode enabled"
}

# Function to disable maintenance mode
disable_maintenance() {
    print_status "Disabling maintenance mode..."
    
    # Remove maintenance files
    rm -f "$MAINTENANCE_FILE"
    rm -f ".maintenance"
    
    print_success "Maintenance mode disabled"
}

# Function to run migration
run_migration() {
    print_status "Running database migration..."
    
    # Deploy migrations
    if npx prisma migrate deploy; then
        print_success "Migration deployed successfully"
    else
        print_error "Migration deployment failed"
        return 1
    fi
    
    # Generate Prisma client
    if npx prisma generate; then
        print_success "Prisma client generated successfully"
    else
        print_error "Failed to generate Prisma client"
        return 1
    fi
}

# Function to verify migration
verify_migration() {
    print_status "Verifying migration..."
    
    # Check migration status
    if npx prisma migrate status; then
        print_success "Migration verification passed"
    else
        print_error "Migration verification failed"
        return 1
    fi
}

# Function to rollback migration
rollback_migration() {
    print_status "Rolling back migration..."
    
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        print_error "Backup file not specified for rollback"
        return 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi
    
    # Rollback based on database type
    if [[ "$DATABASE_URL" == *"postgresql"* ]]; then
        print_status "Restoring PostgreSQL backup..."
        
        # Extract database info from URL
        db_url_without_protocol="${DATABASE_URL#*://}"
        db_credentials="${db_url_without_protocol%%@*}"
        db_host_and_db="${db_url_without_protocol#*@}"
        db_host="${db_host_and_db%%/*}"
        db_name="${db_host_and_db##*/}"
        
        # Restore backup
        if PGPASSWORD="${db_credentials#*:}" psql -h "${db_host%%:*}" -p "${db_host##*:}" -U "${db_credentials%%:*}" -d "$db_name" < "$backup_file"; then
            print_success "PostgreSQL backup restored"
        else
            print_error "Failed to restore PostgreSQL backup"
            return 1
        fi
    
    elif [[ "$DATABASE_URL" == *"sqlite"* ]] || [[ "$DATABASE_URL" == *"file:"* ]]; then
        print_status "Restoring SQLite backup..."
        
        db_file="${DATABASE_URL#*:}"
        
        if cp "$backup_file" "$db_file"; then
            print_success "SQLite backup restored"
        else
            print_error "Failed to restore SQLite backup"
            return 1
        fi
    fi
}

# Function to cleanup old backups
cleanup_backups() {
    print_status "Cleaning up old backups..."
    
    # Keep only last 10 backups
    find "$BACKUP_DIR" -name "backup_prod_*.sql" -o -name "backup_prod_*.db" | sort -r | tail -n +11 | xargs rm -f
    
    print_success "Backup cleanup completed"
}

# Function to show migration status
show_status() {
    print_status "Current migration status:"
    npx prisma migrate status
}

# Function to show help
show_help() {
    echo "Production Migration Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy           Deploy migrations to production"
    echo "  rollback <file>  Rollback to a specific backup"
    echo "  status           Show migration status"
    echo "  backup           Create database backup only"
    echo "  cleanup          Cleanup old backups"
    echo "  help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy"
    echo "  $0 rollback backups/backup_prod_20250708_120000.sql"
    echo "  $0 status"
    echo "  $0 backup"
    echo "  $0 cleanup"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL     Database connection string (required)"
    echo "  SKIP_BACKUP      Skip backup creation (optional)"
    echo "  SKIP_MAINTENANCE Skip maintenance mode (optional)"
}

# Function to deploy migrations
deploy_migrations() {
    local backup_file=""
    
    # Enable maintenance mode unless skipped
    if [ -z "$SKIP_MAINTENANCE" ]; then
        enable_maintenance
    fi
    
    # Create backup unless skipped
    if [ -z "$SKIP_BACKUP" ]; then
        create_backup
        backup_file="$BACKUP_DIR/backup_prod_$TIMESTAMP.sql"
        if [[ "$DATABASE_URL" == *"sqlite"* ]]; then
            backup_file="$BACKUP_DIR/backup_prod_$TIMESTAMP.db"
        fi
    fi
    
    # Run migration
    if run_migration && verify_migration; then
        print_success "Migration deployment completed successfully"
        cleanup_backups
    else
        print_error "Migration deployment failed"
        
        # Rollback if backup was created
        if [ -n "$backup_file" ] && [ -f "$backup_file" ]; then
            print_status "Attempting to rollback..."
            if rollback_migration "$backup_file"; then
                print_success "Rollback completed successfully"
            else
                print_error "Rollback failed - manual intervention required"
            fi
        fi
        
        disable_maintenance
        exit 1
    fi
    
    # Disable maintenance mode
    if [ -z "$SKIP_MAINTENANCE" ]; then
        disable_maintenance
    fi
}

# Main script logic
print_status "Production migration script started"

case "$1" in
    deploy)
        check_prerequisites
        deploy_migrations
        ;;
    rollback)
        check_prerequisites
        enable_maintenance
        rollback_migration "$2"
        disable_maintenance
        ;;
    status)
        show_status
        ;;
    backup)
        check_prerequisites
        create_backup
        ;;
    cleanup)
        cleanup_backups
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

print_success "Production migration script completed!"