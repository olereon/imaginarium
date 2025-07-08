# Docker Setup for Imaginarium

This directory contains Docker configuration files and documentation for running Imaginarium in containerized environments.

## Quick Start

### Development Environment

1. **Setup environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

2. **Start development environment:**
   ```bash
   npm run docker:dev:start
   # or directly:
   ./scripts/docker-dev.sh start
   ```

3. **Access services:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - MinIO Console: http://localhost:9001 (minioadmin/minioadmin)
   - MailHog: http://localhost:8025
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

### Production Environment

1. **Setup production environment variables:**
   ```bash
   cp .env.example .env.production
   # Edit with production values
   ```

2. **Deploy to production:**
   ```bash
   sudo npm run docker:prod:deploy
   # or directly:
   sudo ./scripts/docker-prod.sh deploy
   ```

## Architecture

### Multi-Stage Dockerfile

The main `Dockerfile` uses multi-stage builds for optimized images:

- **base**: Common dependencies and system packages
- **deps**: Production dependencies only
- **dev-deps**: All dependencies for development
- **builder**: Builds the application
- **server-prod**: Optimized production server image
- **server-dev**: Development server with hot reloading
- **client-builder**: Builds the React frontend
- **client-prod**: Production-ready client with Nginx
- **dev**: Full development environment

### Services

#### Development (`docker-compose.yml`)

- **postgres**: PostgreSQL 16 database
- **redis**: Redis for caching and queues
- **server**: Express.js backend (development mode)
- **client**: React frontend (Vite dev server)
- **minio**: S3-compatible object storage
- **mailhog**: Email testing
- **nginx**: Optional reverse proxy (production-like profile)

#### Production (`docker-compose.prod.yml`)

- **postgres**: PostgreSQL 16 database
- **redis**: Redis for caching and queues
- **server**: Express.js backend (production build)
- **client**: React frontend (Nginx static)
- **nginx**: Reverse proxy and load balancer

## Configuration Files

### Nginx

- `nginx.conf`: Production Nginx configuration
- `nginx/dev.conf`: Development Nginx configuration with proxy setup

### Redis

- `redis/redis.conf`: Redis configuration with security and performance settings

### PostgreSQL

- `postgres/init/01-init.sql`: Database initialization script

## Volume Mounts

### Development

Source code is mounted for hot reloading:
```yaml
volumes:
  - .:/app
  - /app/node_modules  # Exclude node_modules from host
```

### Production

Only data volumes are mounted:
```yaml
volumes:
  - uploads_data:/app/uploads
  - outputs_data:/app/outputs
```

## Environment Variables

### Required for Production

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token signing
- `OPENAI_API_KEY`: OpenAI API key
- `CORS_ORIGIN`: Frontend origin URL

### Optional

- `STABILITY_AI_API_KEY`: Stability AI API key
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: AWS credentials
- `SENTRY_DSN`: Error tracking
- `SMTP_*`: Email configuration

## Scripts

### Development Script (`scripts/docker-dev.sh`)

```bash
./scripts/docker-dev.sh start     # Start development environment
./scripts/docker-dev.sh stop      # Stop all services
./scripts/docker-dev.sh restart   # Restart services
./scripts/docker-dev.sh logs      # View logs
./scripts/docker-dev.sh logs server  # View specific service logs
./scripts/docker-dev.sh test      # Run tests
./scripts/docker-dev.sh clean     # Clean up Docker resources
./scripts/docker-dev.sh health    # Check service health
./scripts/docker-dev.sh shell server  # Enter service shell
```

### Production Script (`scripts/docker-prod.sh`)

```bash
sudo ./scripts/docker-prod.sh deploy    # Deploy production
sudo ./scripts/docker-prod.sh update    # Update deployment
sudo ./scripts/docker-prod.sh backup    # Backup database
sudo ./scripts/docker-prod.sh restore backup.sql  # Restore database
sudo ./scripts/docker-prod.sh logs      # View logs
sudo ./scripts/docker-prod.sh health    # Check health
sudo ./scripts/docker-prod.sh stop      # Stop services
```

## Networking

Services communicate through the `imaginarium-network` bridge network:

- Frontend → Backend: `http://server:3000`
- Backend → Database: `postgresql://postgres:5432/imaginarium`
- Backend → Redis: `redis://redis:6379`
- Backend → MinIO: `http://minio:9000`

## Security

### Development

- Default credentials for easy setup
- Services exposed on host ports
- File system permissions relaxed

### Production

- Strong passwords required
- Services isolated in Docker network
- Read-only containers where possible
- Non-root user execution
- Security headers in Nginx

## Performance

### Development

- Hot reloading enabled
- Source maps included
- Verbose logging
- Development optimizations

### Production

- Multi-stage builds for minimal image size
- Gzip compression
- Asset caching
- Connection pooling
- Optimized Nginx configuration

## Monitoring

### Health Checks

All services include health checks:
- Database connectivity
- Application endpoints
- Service readiness

### Logging

Centralized logging through Docker:
```bash
docker-compose logs -f [service]
```

### Metrics

Production setup includes:
- Application metrics
- Resource monitoring
- Error tracking (with Sentry)

## Backup and Recovery

### Database Backup

```bash
# Create backup
sudo ./scripts/docker-prod.sh backup

# List backups
ls -la backup_*.sql

# Restore backup
sudo ./scripts/docker-prod.sh restore backup_20231201_120000.sql
```

### Volume Backup

```bash
# Backup volumes
docker run --rm -v imaginarium_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data

# Restore volumes
docker run --rm -v imaginarium_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_backup.tar.gz -C /
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 5173, 5432, 6379 are available
2. **Permission errors**: Use `sudo` for production commands
3. **Network issues**: Check Docker network configuration
4. **Build failures**: Clear Docker cache with `docker system prune`

### Debug Mode

Enable debug logging:
```bash
export DEBUG=imaginarium:*
docker-compose up
```

### Service Status

Check service status:
```bash
docker-compose ps
./scripts/docker-dev.sh health
```

## Development Workflow

1. **Start environment**: `npm run docker:dev:start`
2. **Make changes**: Code changes trigger hot reload
3. **Run tests**: `npm run docker:dev:test`
4. **View logs**: `npm run docker:dev:logs`
5. **Stop environment**: `npm run docker:dev:stop`

## Production Deployment

1. **Prepare environment**: Configure `.env` with production values
2. **Deploy**: `sudo npm run docker:prod:deploy`
3. **Monitor**: Check logs and health endpoints
4. **Backup**: Regular database backups
5. **Update**: Use update script for new releases