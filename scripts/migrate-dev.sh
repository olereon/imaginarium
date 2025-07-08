#!/bin/bash

# Development Migration Script
# This script handles database migrations for development environment

set -e

echo "🚀 Starting development migration process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_FILE="prisma/data/imaginarium.db"
BACKUP_DIR="prisma/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

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

# Function to create backup
create_backup() {
    print_status "Creating database backup..."
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Create backup if database exists
    if [ -f "$DB_FILE" ]; then
        cp "$DB_FILE" "$BACKUP_DIR/backup_dev_$TIMESTAMP.db"
        print_success "Backup created: $BACKUP_DIR/backup_dev_$TIMESTAMP.db"
    else
        print_warning "Database file not found, skipping backup"
    fi
}

# Function to run migration
run_migration() {
    local migration_name="$1"
    
    if [ -z "$migration_name" ]; then
        print_error "Migration name is required"
        echo "Usage: $0 <migration_name>"
        exit 1
    fi
    
    print_status "Running migration: $migration_name"
    
    # Run the migration
    if npx prisma migrate dev --name "$migration_name"; then
        print_success "Migration completed successfully"
    else
        print_error "Migration failed"
        exit 1
    fi
}

# Function to reset database
reset_database() {
    print_warning "This will reset the development database and lose all data!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Resetting database..."
        
        # Create backup before reset
        create_backup
        
        # Reset database
        if npx prisma migrate reset --force; then
            print_success "Database reset completed"
        else
            print_error "Database reset failed"
            exit 1
        fi
    else
        print_status "Database reset cancelled"
    fi
}

# Function to show current migration status
show_status() {
    print_status "Current migration status:"
    npx prisma migrate status
}

# Function to generate Prisma client
generate_client() {
    print_status "Generating Prisma client..."
    
    if npx prisma generate; then
        print_success "Prisma client generated successfully"
    else
        print_error "Failed to generate Prisma client"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Development Migration Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  migrate <name>    Create and run a new migration"
    echo "  reset            Reset the database (development only)"
    echo "  status           Show migration status"
    echo "  generate         Generate Prisma client"
    echo "  backup           Create database backup"
    echo "  help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 migrate add_user_preferences"
    echo "  $0 reset"
    echo "  $0 status"
    echo "  $0 generate"
    echo "  $0 backup"
}

# Main script logic
case "$1" in
    migrate)
        create_backup
        run_migration "$2"
        generate_client
        ;;
    reset)
        reset_database
        generate_client
        ;;
    status)
        show_status
        ;;
    generate)
        generate_client
        ;;
    backup)
        create_backup
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

print_success "Development migration script completed!"