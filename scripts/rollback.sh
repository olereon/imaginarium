#!/bin/bash

# Database Rollback Script
# This script handles database rollbacks for different environments

set -e

echo "🔄 Starting database rollback process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="backups"
DEV_BACKUP_DIR="prisma/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="rollback_${TIMESTAMP}.log"

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

# Function to detect environment
detect_environment() {
    if [ "$NODE_ENV" == "production" ]; then
        echo "production"
    elif [ "$NODE_ENV" == "staging" ]; then
        echo "staging"
    else
        echo "development"
    fi
}

# Function to get backup directory based on environment
get_backup_dir() {
    local env="$1"
    
    case "$env" in
        development)
            echo "$DEV_BACKUP_DIR"
            ;;
        production|staging)
            echo "$BACKUP_DIR"
            ;;
        *)
            echo "$BACKUP_DIR"
            ;;
    esac
}

# Function to list available backups
list_backups() {
    local env="$1"
    local backup_dir=$(get_backup_dir "$env")
    
    print_status "Available backups in $backup_dir:"
    
    if [ ! -d "$backup_dir" ]; then
        print_error "Backup directory not found: $backup_dir"
        return 1
    fi
    
    # List backups with details
    local backups=$(find "$backup_dir" -name "backup_*" -type f | sort -r)
    
    if [ -z "$backups" ]; then
        print_warning "No backups found in $backup_dir"
        return 1
    fi
    
    echo ""
    echo "Available backups:"
    echo "=================="
    
    local count=1
    for backup in $backups; do
        local filename=$(basename "$backup")
        local size=$(du -h "$backup" | cut -f1)
        local date=$(stat -c %y "$backup" 2>/dev/null || stat -f %Sm "$backup" 2>/dev/null || echo "Unknown")
        
        printf "%2d. %s (%s) - %s\n" "$count" "$filename" "$size" "$date"
        count=$((count + 1))
    done
    
    echo ""
}

# Function to select backup interactively
select_backup() {
    local env="$1"
    local backup_dir=$(get_backup_dir "$env")
    local backups=$(find "$backup_dir" -name "backup_*" -type f | sort -r)
    
    if [ -z "$backups" ]; then
        print_error "No backups available for selection"
        return 1
    fi
    
    local backup_array=($backups)
    local count=${#backup_array[@]}
    
    echo "Select a backup to restore:"
    read -p "Enter number (1-$count): " -r selection
    
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt "$count" ]; then
        print_error "Invalid selection: $selection"
        return 1
    fi
    
    local selected_backup="${backup_array[$((selection - 1))]}"
    echo "$selected_backup"
}

# Function to create pre-rollback backup
create_pre_rollback_backup() {
    local env="$1"
    local backup_dir=$(get_backup_dir "$env")
    
    print_status "Creating pre-rollback backup..."
    
    mkdir -p "$backup_dir"
    
    # Create backup based on database type
    if [[ "$DATABASE_URL" == *"postgresql"* ]]; then
        local backup_file="$backup_dir/pre_rollback_$TIMESTAMP.sql"
        
        # Extract database info from URL
        local db_url_without_protocol="${DATABASE_URL#*://}"
        local db_credentials="${db_url_without_protocol%%@*}"
        local db_host_and_db="${db_url_without_protocol#*@}"
        local db_host="${db_host_and_db%%/*}"
        local db_name="${db_host_and_db##*/}"
        
        # Create backup
        if PGPASSWORD="${db_credentials#*:}" pg_dump -h "${db_host%%:*}" -p "${db_host##*:}" -U "${db_credentials%%:*}" -d "$db_name" > "$backup_file"; then
            print_success "Pre-rollback backup created: $backup_file"
        else
            print_error "Failed to create pre-rollback backup"
            return 1
        fi
    
    elif [[ "$DATABASE_URL" == *"sqlite"* ]] || [[ "$DATABASE_URL" == *"file:"* ]]; then
        local db_file="${DATABASE_URL#*:}"
        local backup_file="$backup_dir/pre_rollback_$TIMESTAMP.db"
        
        if [ -f "$db_file" ]; then
            cp "$db_file" "$backup_file"
            print_success "Pre-rollback backup created: $backup_file"
        else
            print_error "Database file not found: $db_file"
            return 1
        fi
    fi
}

# Function to restore from backup
restore_backup() {
    local backup_file="$1"
    local env="$2"
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi
    
    print_status "Restoring from backup: $backup_file"
    
    # Stop application if in production
    if [ "$env" == "production" ]; then
        print_status "Enabling maintenance mode..."
        touch ".maintenance"
    fi
    
    # Restore based on database type
    if [[ "$DATABASE_URL" == *"postgresql"* ]]; then
        print_status "Restoring PostgreSQL backup..."
        
        # Extract database info from URL
        local db_url_without_protocol="${DATABASE_URL#*://}"
        local db_credentials="${db_url_without_protocol%%@*}"
        local db_host_and_db="${db_url_without_protocol#*@}"
        local db_host="${db_host_and_db%%/*}"
        local db_name="${db_host_and_db##*/}"
        
        # Restore backup
        if PGPASSWORD="${db_credentials#*:}" psql -h "${db_host%%:*}" -p "${db_host##*:}" -U "${db_credentials%%:*}" -d "$db_name" < "$backup_file"; then
            print_success "PostgreSQL backup restored successfully"
        else
            print_error "Failed to restore PostgreSQL backup"
            return 1
        fi
    
    elif [[ "$DATABASE_URL" == *"sqlite"* ]] || [[ "$DATABASE_URL" == *"file:"* ]]; then
        print_status "Restoring SQLite backup..."
        
        local db_file="${DATABASE_URL#*:}"
        
        if cp "$backup_file" "$db_file"; then
            print_success "SQLite backup restored successfully"
        else
            print_error "Failed to restore SQLite backup"
            return 1
        fi
    else
        print_error "Unsupported database type"
        return 1
    fi
    
    # Generate Prisma client
    if npx prisma generate; then
        print_success "Prisma client regenerated"
    else
        print_warning "Failed to regenerate Prisma client"
    fi
    
    # Disable maintenance mode
    if [ "$env" == "production" ]; then
        print_status "Disabling maintenance mode..."
        rm -f ".maintenance"
    fi
}

# Function to verify database state
verify_database() {
    print_status "Verifying database state..."
    
    # Check migration status
    if npx prisma migrate status; then
        print_success "Database verification passed"
    else
        print_warning "Database verification failed - migration status unclear"
    fi
    
    # Try to connect to database
    if npx prisma db push --preview-feature >/dev/null 2>&1; then
        print_success "Database connection verified"
    else
        print_warning "Database connection verification failed"
    fi
}

# Function to rollback to specific migration
rollback_to_migration() {
    local migration_name="$1"
    local env="$2"
    
    print_status "Rolling back to migration: $migration_name"
    print_warning "This is a destructive operation and cannot be undone!"
    
    # Create pre-rollback backup
    create_pre_rollback_backup "$env"
    
    # For development, we can reset and migrate to specific point
    if [ "$env" == "development" ]; then
        print_status "Resetting development database..."
        npx prisma migrate reset --force
        
        # Apply migrations up to the specified point
        print_status "Applying migrations up to: $migration_name"
        # Note: This is a simplified approach - in practice, you'd need to
        # temporarily move later migrations and then restore them
        print_warning "Manual migration management required for partial rollback"
    else
        print_error "Migration rollback not supported for $env environment"
        print_error "Please use backup restoration instead"
        return 1
    fi
}

# Function to show rollback history
show_rollback_history() {
    local env="$1"
    local backup_dir=$(get_backup_dir "$env")
    
    print_status "Rollback history for $env environment:"
    
    if [ -f "$backup_dir/rollback_history.log" ]; then
        cat "$backup_dir/rollback_history.log"
    else
        print_warning "No rollback history found"
    fi
}

# Function to log rollback action
log_rollback() {
    local env="$1"
    local backup_file="$2"
    local backup_dir=$(get_backup_dir "$env")
    
    mkdir -p "$backup_dir"
    
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Rollback performed in $env environment" >> "$backup_dir/rollback_history.log"
    echo "  Backup file: $backup_file" >> "$backup_dir/rollback_history.log"
    echo "  User: $(whoami)" >> "$backup_dir/rollback_history.log"
    echo "  Database URL: ${DATABASE_URL%%@*}@***" >> "$backup_dir/rollback_history.log"
    echo "" >> "$backup_dir/rollback_history.log"
}

# Function to show help
show_help() {
    echo "Database Rollback Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  list                     List available backups"
    echo "  restore <backup-file>    Restore from specific backup file"
    echo "  interactive              Interactive backup selection and restore"
    echo "  migration <name>         Rollback to specific migration (dev only)"
    echo "  history                  Show rollback history"
    echo "  help                     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 restore backups/backup_prod_20250708_120000.sql"
    echo "  $0 interactive"
    echo "  $0 migration 20250708_add_user_preferences"
    echo "  $0 history"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL    Database connection string (required)"
    echo "  NODE_ENV        Environment (development/staging/production)"
}

# Main script logic
ENV=$(detect_environment)
print_status "Detected environment: $ENV"

case "$1" in
    list)
        list_backups "$ENV"
        ;;
    restore)
        if [ -z "$2" ]; then
            print_error "Backup file path required"
            show_help
            exit 1
        fi
        
        print_warning "This will restore the database from backup: $2"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            create_pre_rollback_backup "$ENV"
            restore_backup "$2" "$ENV"
            verify_database
            log_rollback "$ENV" "$2"
            print_success "Rollback completed successfully"
        else
            print_status "Rollback cancelled"
        fi
        ;;
    interactive)
        list_backups "$ENV"
        backup_file=$(select_backup "$ENV")
        
        if [ -n "$backup_file" ]; then
            print_warning "This will restore the database from backup: $backup_file"
            read -p "Are you sure you want to continue? (y/N): " -n 1 -r
            echo
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                create_pre_rollback_backup "$ENV"
                restore_backup "$backup_file" "$ENV"
                verify_database
                log_rollback "$ENV" "$backup_file"
                print_success "Rollback completed successfully"
            else
                print_status "Rollback cancelled"
            fi
        fi
        ;;
    migration)
        if [ -z "$2" ]; then
            print_error "Migration name required"
            show_help
            exit 1
        fi
        
        rollback_to_migration "$2" "$ENV"
        ;;
    history)
        show_rollback_history "$ENV"
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

print_success "Rollback script completed!"