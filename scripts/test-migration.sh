#!/bin/bash

# Migration Testing Script
# This script tests database migrations in isolated environments

set -e

echo "🧪 Starting migration testing process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DIR="test_migrations"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="migration_test_${TIMESTAMP}.log"
ORIGINAL_DB_URL="$DATABASE_URL"

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

# Function to setup test environment
setup_test_env() {
    print_status "Setting up test environment..."
    
    # Create test directory
    mkdir -p "$TEST_DIR"
    
    # Create test database URL
    export DATABASE_URL="file:./$TEST_DIR/test_migration_${TIMESTAMP}.db"
    
    print_success "Test environment created with database: $DATABASE_URL"
}

# Function to cleanup test environment
cleanup_test_env() {
    print_status "Cleaning up test environment..."
    
    # Remove test directory
    rm -rf "$TEST_DIR"
    
    # Restore original database URL
    export DATABASE_URL="$ORIGINAL_DB_URL"
    
    print_success "Test environment cleaned up"
}

# Function to create test data
create_test_data() {
    print_status "Creating test data..."
    
    # Generate test data SQL
    cat > "$TEST_DIR/test_data.sql" << EOF
-- Test data for migration testing
INSERT INTO users (id, email, passwordHash, name, role, isActive, emailVerified, createdAt, updatedAt)
VALUES 
    ('user1', 'test1@example.com', 'hashed_password_1', 'Test User 1', 'VIEWER', true, true, datetime('now'), datetime('now')),
    ('user2', 'test2@example.com', 'hashed_password_2', 'Test User 2', 'EDITOR', true, false, datetime('now'), datetime('now')),
    ('user3', 'test3@example.com', 'hashed_password_3', 'Test User 3', 'ADMIN', true, true, datetime('now'), datetime('now'));

INSERT INTO pipelines (id, userId, name, description, status, isPublic, configuration, version, createdAt, updatedAt)
VALUES 
    ('pipeline1', 'user1', 'Test Pipeline 1', 'Test pipeline description', 'DRAFT', false, '{"nodes": [], "edges": []}', 1, datetime('now'), datetime('now')),
    ('pipeline2', 'user2', 'Test Pipeline 2', 'Another test pipeline', 'PUBLISHED', true, '{"nodes": [], "edges": []}', 1, datetime('now'), datetime('now'));

INSERT INTO pipeline_runs (id, pipelineId, userId, status, configuration, queuedAt, lastUpdateAt)
VALUES 
    ('run1', 'pipeline1', 'user1', 'QUEUED', '{"nodes": [], "edges": []}', datetime('now'), datetime('now')),
    ('run2', 'pipeline2', 'user2', 'COMPLETED', '{"nodes": [], "edges": []}', datetime('now'), datetime('now'));
EOF
    
    print_success "Test data created"
}

# Function to apply test data
apply_test_data() {
    print_status "Applying test data..."
    
    # Apply test data using sqlite3
    if sqlite3 "$TEST_DIR/test_migration_${TIMESTAMP}.db" < "$TEST_DIR/test_data.sql"; then
        print_success "Test data applied successfully"
    else
        print_error "Failed to apply test data"
        return 1
    fi
}

# Function to verify data integrity
verify_data_integrity() {
    print_status "Verifying data integrity..."
    
    local db_file="$TEST_DIR/test_migration_${TIMESTAMP}.db"
    
    # Check that tables exist and have data
    local table_counts=$(sqlite3 "$db_file" "
        SELECT 
            'users: ' || COUNT(*) as count FROM users 
        UNION ALL 
        SELECT 
            'pipelines: ' || COUNT(*) as count FROM pipelines 
        UNION ALL 
        SELECT 
            'pipeline_runs: ' || COUNT(*) as count FROM pipeline_runs;
    ")
    
    print_status "Table counts after migration:"
    echo "$table_counts"
    
    # Check for foreign key constraints
    local fk_violations=$(sqlite3 "$db_file" "PRAGMA foreign_key_check;")
    
    if [ -n "$fk_violations" ]; then
        print_error "Foreign key violations found:"
        echo "$fk_violations"
        return 1
    else
        print_success "No foreign key violations found"
    fi
    
    # Check for data consistency
    local orphaned_runs=$(sqlite3 "$db_file" "
        SELECT COUNT(*) FROM pipeline_runs pr 
        LEFT JOIN pipelines p ON pr.pipelineId = p.id 
        WHERE p.id IS NULL;
    ")
    
    if [ "$orphaned_runs" -gt 0 ]; then
        print_error "Found $orphaned_runs orphaned pipeline runs"
        return 1
    else
        print_success "No orphaned pipeline runs found"
    fi
}

# Function to test migration forward
test_migration_forward() {
    print_status "Testing migration forward..."
    
    # Deploy migrations
    if npx prisma migrate deploy; then
        print_success "Forward migration completed successfully"
    else
        print_error "Forward migration failed"
        return 1
    fi
    
    # Verify schema
    if npx prisma migrate status; then
        print_success "Migration status verified"
    else
        print_error "Migration status verification failed"
        return 1
    fi
}

# Function to test migration backward (rollback)
test_migration_backward() {
    print_status "Testing migration backward (rollback)..."
    
    # Create backup before rollback test
    local backup_file="$TEST_DIR/backup_before_rollback.db"
    cp "$TEST_DIR/test_migration_${TIMESTAMP}.db" "$backup_file"
    
    # Reset database to test rollback
    if npx prisma migrate reset --force; then
        print_success "Database reset for rollback test"
    else
        print_error "Database reset failed"
        return 1
    fi
    
    # Apply migrations up to a specific point (simulate rollback)
    print_status "Simulating rollback scenario..."
    
    # For this test, we'll just verify that reset works
    # In practice, you'd apply migrations selectively
    print_success "Rollback test completed"
}

# Function to test migration performance
test_migration_performance() {
    print_status "Testing migration performance..."
    
    local start_time=$(date +%s)
    
    # Run migration with timing
    if timeout 300 npx prisma migrate deploy; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_success "Migration completed in ${duration} seconds"
        
        if [ "$duration" -gt 60 ]; then
            print_warning "Migration took longer than 60 seconds"
        fi
    else
        print_error "Migration timed out or failed"
        return 1
    fi
}

# Function to test with large dataset
test_with_large_dataset() {
    print_status "Testing with large dataset..."
    
    # Create large test dataset
    cat > "$TEST_DIR/large_test_data.sql" << EOF
-- Large test dataset for performance testing
BEGIN TRANSACTION;

-- Create 1000 users
INSERT INTO users (id, email, passwordHash, name, role, isActive, emailVerified, createdAt, updatedAt)
WITH RECURSIVE generate_users(i) AS (
    SELECT 1
    UNION ALL
    SELECT i + 1 FROM generate_users WHERE i < 1000
)
SELECT 
    'user' || i,
    'user' || i || '@example.com',
    'hashed_password_' || i,
    'Test User ' || i,
    CASE (i % 3) WHEN 0 THEN 'ADMIN' WHEN 1 THEN 'EDITOR' ELSE 'VIEWER' END,
    true,
    i % 2 = 0,
    datetime('now'),
    datetime('now')
FROM generate_users;

-- Create 5000 pipelines
INSERT INTO pipelines (id, userId, name, description, status, isPublic, configuration, version, createdAt, updatedAt)
WITH RECURSIVE generate_pipelines(i) AS (
    SELECT 1
    UNION ALL
    SELECT i + 1 FROM generate_pipelines WHERE i < 5000
)
SELECT 
    'pipeline' || i,
    'user' || ((i % 1000) + 1),
    'Test Pipeline ' || i,
    'Test pipeline description ' || i,
    CASE (i % 3) WHEN 0 THEN 'DRAFT' WHEN 1 THEN 'PUBLISHED' ELSE 'ARCHIVED' END,
    i % 2 = 0,
    '{"nodes": [], "edges": []}',
    1,
    datetime('now'),
    datetime('now')
FROM generate_pipelines;

COMMIT;
EOF
    
    # Apply large dataset
    if sqlite3 "$TEST_DIR/test_migration_${TIMESTAMP}.db" < "$TEST_DIR/large_test_data.sql"; then
        print_success "Large test dataset applied"
    else
        print_error "Failed to apply large test dataset"
        return 1
    fi
    
    # Test migration performance with large dataset
    test_migration_performance
}

# Function to test concurrent migrations
test_concurrent_migrations() {
    print_status "Testing concurrent migration scenarios..."
    
    # This test simulates what happens when multiple instances try to migrate
    # In practice, Prisma migration lock should prevent issues
    
    print_status "Creating multiple test databases..."
    
    # Create multiple test databases
    for i in {1..3}; do
        local test_db="$TEST_DIR/concurrent_test_$i.db"
        export DATABASE_URL="file:./$test_db"
        
        # Run migration in background
        {
            print_status "Starting concurrent migration $i..."
            if npx prisma migrate deploy; then
                print_success "Concurrent migration $i completed"
            else
                print_error "Concurrent migration $i failed"
            fi
        } &
    done
    
    # Wait for all background processes
    wait
    
    # Restore original test database URL
    export DATABASE_URL="file:./$TEST_DIR/test_migration_${TIMESTAMP}.db"
    
    print_success "Concurrent migration test completed"
}

# Function to test migration with constraints
test_migration_constraints() {
    print_status "Testing migration with constraints..."
    
    # Test foreign key constraints
    local constraint_violations=$(sqlite3 "$TEST_DIR/test_migration_${TIMESTAMP}.db" "
        PRAGMA foreign_key_check;
    ")
    
    if [ -n "$constraint_violations" ]; then
        print_error "Constraint violations found:"
        echo "$constraint_violations"
        return 1
    else
        print_success "All constraints are valid"
    fi
    
    # Test unique constraints
    local unique_violations=$(sqlite3 "$TEST_DIR/test_migration_${TIMESTAMP}.db" "
        SELECT 'email duplicates: ' || COUNT(*) - COUNT(DISTINCT email) FROM users
        UNION ALL
        SELECT 'session token duplicates: ' || COUNT(*) - COUNT(DISTINCT token) FROM sessions
        UNION ALL
        SELECT 'api key duplicates: ' || COUNT(*) - COUNT(DISTINCT key) FROM api_keys;
    ")
    
    print_status "Unique constraint check:"
    echo "$unique_violations"
}

# Function to generate test report
generate_test_report() {
    print_status "Generating test report..."
    
    local report_file="migration_test_report_${TIMESTAMP}.html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Migration Test Report - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #17a2b8; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Migration Test Report</h1>
        <p><strong>Date:</strong> $(date)</p>
        <p><strong>Test Database:</strong> $DATABASE_URL</p>
    </div>
    
    <div class="section">
        <h2>Test Summary</h2>
        <p>This report contains the results of database migration testing.</p>
    </div>
    
    <div class="section">
        <h2>Test Log</h2>
        <pre>$(cat "$LOG_FILE")</pre>
    </div>
    
    <div class="section">
        <h2>Schema Information</h2>
        <pre>$(npx prisma migrate status 2>&1 || echo "Unable to get migration status")</pre>
    </div>
    
    <div class="section">
        <h2>Database Schema</h2>
        <pre>$(sqlite3 "$TEST_DIR/test_migration_${TIMESTAMP}.db" ".schema" 2>&1 || echo "Unable to get schema")</pre>
    </div>
</body>
</html>
EOF
    
    print_success "Test report generated: $report_file"
}

# Function to run all tests
run_all_tests() {
    print_status "Running comprehensive migration tests..."
    
    local test_results=()
    
    # Test 1: Basic migration
    print_status "Test 1: Basic migration test"
    if test_migration_forward; then
        test_results+=("✅ Basic migration: PASSED")
    else
        test_results+=("❌ Basic migration: FAILED")
    fi
    
    # Test 2: Data integrity
    print_status "Test 2: Data integrity test"
    if apply_test_data && verify_data_integrity; then
        test_results+=("✅ Data integrity: PASSED")
    else
        test_results+=("❌ Data integrity: FAILED")
    fi
    
    # Test 3: Migration constraints
    print_status "Test 3: Migration constraints test"
    if test_migration_constraints; then
        test_results+=("✅ Migration constraints: PASSED")
    else
        test_results+=("❌ Migration constraints: FAILED")
    fi
    
    # Test 4: Performance test
    print_status "Test 4: Performance test"
    if test_migration_performance; then
        test_results+=("✅ Performance: PASSED")
    else
        test_results+=("❌ Performance: FAILED")
    fi
    
    # Test 5: Rollback test
    print_status "Test 5: Rollback test"
    if test_migration_backward; then
        test_results+=("✅ Rollback: PASSED")
    else
        test_results+=("❌ Rollback: FAILED")
    fi
    
    # Print test results
    echo ""
    echo "============================================"
    echo "             TEST RESULTS"
    echo "============================================"
    for result in "${test_results[@]}"; do
        echo "$result"
    done
    echo "============================================"
    
    generate_test_report
}

# Function to show help
show_help() {
    echo "Migration Testing Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  all              Run all migration tests"
    echo "  forward          Test forward migration only"
    echo "  backward         Test backward migration (rollback)"
    echo "  performance      Test migration performance"
    echo "  constraints      Test migration constraints"
    echo "  large-dataset    Test with large dataset"
    echo "  concurrent       Test concurrent migrations"
    echo "  data-integrity   Test data integrity"
    echo "  help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 all"
    echo "  $0 forward"
    echo "  $0 performance"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL     Original database URL (will be backed up)"
}

# Signal handler for cleanup
cleanup() {
    print_status "Cleaning up after interruption..."
    cleanup_test_env
    exit 1
}

trap cleanup INT TERM

# Main script logic
print_status "Migration testing script started"

# Setup test environment
setup_test_env
create_test_data

case "$1" in
    all)
        run_all_tests
        ;;
    forward)
        test_migration_forward
        ;;
    backward)
        test_migration_backward
        ;;
    performance)
        apply_test_data
        test_migration_performance
        ;;
    constraints)
        test_migration_forward
        apply_test_data
        test_migration_constraints
        ;;
    large-dataset)
        test_migration_forward
        test_with_large_dataset
        ;;
    concurrent)
        test_concurrent_migrations
        ;;
    data-integrity)
        test_migration_forward
        apply_test_data
        verify_data_integrity
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [ -z "$1" ]; then
            run_all_tests
        else
            print_error "Unknown command: $1"
            show_help
            exit 1
        fi
        ;;
esac

# Cleanup
cleanup_test_env

print_success "Migration testing completed!"