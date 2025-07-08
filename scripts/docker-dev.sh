#!/bin/bash

# Imaginarium Docker Development Script

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

# Check if Docker and Docker Compose are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Create .env file if it doesn't exist
setup_env() {
    if [ ! -f .env ]; then
        print_status "Creating .env file from .env.example..."
        cp .env.example .env
        print_warning "Please update .env file with your actual values"
    else
        print_status ".env file already exists"
    fi
}

# Function to start development environment
start_dev() {
    print_status "Starting Imaginarium development environment..."
    
    # Create necessary directories
    mkdir -p uploads outputs logs
    
    # Start services
    docker-compose up -d postgres redis minio mailhog
    
    # Wait for databases to be ready
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Start application services
    docker-compose up -d server client
    
    print_success "Development environment started!"
    print_status "Services available at:"
    echo "  - Client:     http://localhost:5173"
    echo "  - Server:     http://localhost:3000"
    echo "  - MinIO:      http://localhost:9001 (admin: minioadmin/minioadmin)"
    echo "  - MailHog:    http://localhost:8025"
    echo "  - Postgres:   localhost:5432"
    echo "  - Redis:      localhost:6379"
}

# Function to stop development environment
stop_dev() {
    print_status "Stopping Imaginarium development environment..."
    docker-compose down
    print_success "Development environment stopped"
}

# Function to restart development environment
restart_dev() {
    print_status "Restarting Imaginarium development environment..."
    docker-compose restart
    print_success "Development environment restarted"
}

# Function to view logs
logs() {
    if [ -n "$2" ]; then
        docker-compose logs -f "$2"
    else
        docker-compose logs -f
    fi
}

# Function to run tests
test() {
    print_status "Running tests in Docker environment..."
    docker-compose exec server npm run test
}

# Function to clean up Docker resources
clean() {
    print_status "Cleaning up Docker resources..."
    docker-compose down -v
    docker system prune -f
    print_success "Cleanup completed"
}

# Function to check service health
health() {
    print_status "Checking service health..."
    docker-compose ps
    
    # Check individual service health
    services=("postgres" "redis" "server")
    for service in "${services[@]}"; do
        if docker-compose exec -T "$service" echo "OK" &> /dev/null; then
            print_success "$service is healthy"
        else
            print_error "$service is not responding"
        fi
    done
}

# Function to enter a service shell
shell() {
    if [ -n "$2" ]; then
        docker-compose exec "$2" /bin/sh
    else
        print_error "Please specify a service name (server, client, postgres, redis)"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Imaginarium Docker Development Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the development environment"
    echo "  stop      Stop the development environment"
    echo "  restart   Restart the development environment"
    echo "  logs      View logs (optional: specify service name)"
    echo "  test      Run tests"
    echo "  clean     Clean up Docker resources"
    echo "  health    Check service health"
    echo "  shell     Enter service shell (requires service name)"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs server"
    echo "  $0 shell server"
}

# Main script logic
main() {
    check_dependencies
    setup_env
    
    case "${1:-start}" in
        start)
            start_dev
            ;;
        stop)
            stop_dev
            ;;
        restart)
            restart_dev
            ;;
        logs)
            logs "$@"
            ;;
        test)
            test
            ;;
        clean)
            clean
            ;;
        health)
            health
            ;;
        shell)
            shell "$@"
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