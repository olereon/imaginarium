#!/bin/bash

# Imaginarium Docker Production Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root or with sudo
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script requires root privileges. Please run with sudo."
        exit 1
    fi
}

# Validate environment variables
validate_env() {
    print_status "Validating environment variables..."
    
    required_vars=(
        "DATABASE_URL"
        "JWT_SECRET" 
        "OPENAI_API_KEY"
        "CORS_ORIGIN"
    )
    
    missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -ne 0 ]]; then
        print_error "Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        print_error "Please set these variables in your .env file or environment"
        exit 1
    fi
    
    print_success "Environment validation passed"
}

# Deploy production environment
deploy() {
    print_status "Deploying Imaginarium production environment..."
    
    # Create necessary directories
    mkdir -p uploads outputs logs ssl
    
    # Build and start production services
    docker-compose -f docker-compose.prod.yml build --no-cache
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 30
    
    # Run database migrations
    print_status "Running database migrations..."
    docker-compose -f docker-compose.prod.yml exec server npm run db:migrate
    
    print_success "Production deployment completed!"
    print_status "Application is available at: ${CORS_ORIGIN}"
}

# Update production environment
update() {
    print_status "Updating Imaginarium production environment..."
    
    # Pull latest code (if using git deployment)
    if [[ -d .git ]]; then
        git pull origin main
    fi
    
    # Rebuild and restart services
    docker-compose -f docker-compose.prod.yml build --no-cache
    docker-compose -f docker-compose.prod.yml up -d --force-recreate
    
    # Run migrations
    docker-compose -f docker-compose.prod.yml exec server npm run db:migrate
    
    print_success "Production update completed!"
}

# Backup database
backup() {
    print_status "Creating database backup..."
    
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="backup_${timestamp}.sql"
    
    docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${backup_file}"
    
    print_success "Database backup created: ${backup_file}"
}

# Restore database from backup
restore() {
    if [[ -z "$2" ]]; then
        print_error "Please specify backup file: $0 restore <backup_file>"
        exit 1
    fi
    
    backup_file="$2"
    
    if [[ ! -f "$backup_file" ]]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    print_warning "This will overwrite the current database. Are you sure? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_status "Restore cancelled"
        exit 0
    fi
    
    print_status "Restoring database from backup: $backup_file"
    
    # Stop server to prevent connections
    docker-compose -f docker-compose.prod.yml stop server
    
    # Restore database
    docker-compose -f docker-compose.prod.yml exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "$backup_file"
    
    # Restart server
    docker-compose -f docker-compose.prod.yml start server
    
    print_success "Database restore completed"
}

# View logs
logs() {
    if [[ -n "$2" ]]; then
        docker-compose -f docker-compose.prod.yml logs -f "$2"
    else
        docker-compose -f docker-compose.prod.yml logs -f
    fi
}

# Check health
health() {
    print_status "Checking production service health..."
    
    # Check service status
    docker-compose -f docker-compose.prod.yml ps
    
    # Check application health endpoints
    if curl -f "${CORS_ORIGIN}/health" &> /dev/null; then
        print_success "Application health check passed"
    else
        print_error "Application health check failed"
    fi
}

# Stop production services
stop() {
    print_warning "This will stop all production services. Are you sure? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_status "Stop cancelled"
        exit 0
    fi
    
    print_status "Stopping production services..."
    docker-compose -f docker-compose.prod.yml down
    print_success "Production services stopped"
}

# Show help
show_help() {
    echo "Imaginarium Docker Production Deployment Script"
    echo ""
    echo "Usage: sudo $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy    Deploy production environment"
    echo "  update    Update production environment"
    echo "  backup    Create database backup"
    echo "  restore   Restore database from backup"
    echo "  logs      View production logs"
    echo "  health    Check service health"
    echo "  stop      Stop production services"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  sudo $0 deploy"
    echo "  sudo $0 backup"
    echo "  sudo $0 restore backup_20231201_120000.sql"
    echo "  sudo $0 logs server"
}

# Main script logic
main() {
    case "${1:-help}" in
        deploy)
            check_permissions
            validate_env
            deploy
            ;;
        update)
            check_permissions
            validate_env
            update
            ;;
        backup)
            check_permissions
            backup
            ;;
        restore)
            check_permissions
            restore "$@"
            ;;
        logs)
            logs "$@"
            ;;
        health)
            health
            ;;
        stop)
            check_permissions
            stop
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
}

# Run main function with all arguments
main "$@"