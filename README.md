# E-commerce Microservices System

This project implements a complete e-commerce microservices system using Node.js, Express.js, MongoDB, RabbitMQ, and Docker. The system consists of four core services (Customer, Product, Order, Payment) and a Queue Worker for asynchronous processing, demonstrating inter-service communication via REST APIs and RabbitMQ messaging.

## Table of Contents
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Setup Environment Variables](#setup-environment-variables)
  - [Building and Running with Docker Compose](#building-and-running-with-docker-compose)
  - [Seeding Initial Data](#seeding-initial-data)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Error Handling](#error-handling)
- [Folder Structure](#folder-structure)
- [Communication Flow (Order Creation)](#communication-flow-order-creation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Architecture
The system is composed of several independent microservices, each responsible for a specific domain:

- **Customer Service (Port 3001):** Manages customer information.
- **Product Service (Port 3002):** Manages product details and stock levels.
- **Order Service (Port 3003):** Orchestrates order creation, interacting with Customer and Product services, and initiating payments.
- **Payment Service (Port 3004):** Handles payment processing and publishes transaction events to RabbitMQ.
- **Queue Worker Service:** Consumes transaction events from RabbitMQ, updates order status, product stock, and records transaction history.

Communication:
- **Synchronous:** REST APIs for inter-service communication (e.g., Order Service calling Customer/Product services).
- **Asynchronous:** RabbitMQ for event-driven communication (e.g., Payment Service publishing transactions, Queue Worker consuming them).

## Technology Stack
- **Backend:** Node.js v18+, Express.js
- **Database:** MongoDB (with Mongoose ODM)
- **Message Queue:** RabbitMQ (with `amqplib`)
- **Containerization:** Docker, Docker Compose
- **Testing:** Jest, Supertest
- **Documentation:** JSDoc comments for API endpoints
- **Other:** `dotenv` for environment variables, `axios` for HTTP requests, `uuidv4` for unique IDs.

## Prerequisites
- Docker Desktop (includes Docker Engine and Docker Compose)
- Node.js v18+ (if running services locally outside Docker or for seed scripts)
- npm or yarn

## Getting Started

### Setup Environment Variables
Create a `.env` file in the root directory (`ecommerce-microservices/.env`) with the following content:

```env
RABBITMQ_URI=amqp://guest:guest@localhost:5672
TRANSACTION_QUEUE=transaction_queue

# MongoDB URIs for individual services
MONGODB_URI_CUSTOMER=mongodb://localhost:27017/customer_db
MONGODB_URI_PRODUCT=mongodb://localhost:27018/product_db
MONGODB_URI_ORDER=mongodb://localhost:27019/order_db
MONGODB_URI_TRANSACTION=mongodb://localhost:27020/transaction_db

# Service URLs (for inter-service communication if not using Docker DNS, or for local testing)
CUSTOMER_SERVICE_URL=http://localhost:3001
PRODUCT_SERVICE_URL=http://localhost:3002
PAYMENT_SERVICE_URL=http://localhost:3004
```

**Note:** When running with Docker Compose, the `docker-compose.yml` file overrides these `localhost` values with service names (e.g., `customer-service:3001`) for inter-container communication. The `.env` is mainly for local development outside Docker or for seeders that need explicit host connections.

### Building and Running with Docker Compose
1.  **Navigate to the `ecommerce-microservices` directory:**
    ```bash
    cd ecommerce-microservices
    ```

2.  **Build and run all services:**
    ```bash
    docker-compose up --build
    ```
    This command will:
    - Build Docker images for all Node.js services (customer, product, order, payment, queue-worker).
    - Start all services including RabbitMQ and the MongoDB instances for each service.
    - The services will be accessible on their respective ports (`3001-3004`) on `localhost`.

3.  **To run services in detached mode (background):**
    ```bash
    docker-compose up --build -d
    ```

4.  **To stop and remove all services:**
    ```bash
    docker-compose down
    ```

### Seeding Initial Data
After starting the services with Docker Compose, you can seed initial customer and product data. The `docker-compose.yml` includes `customer-seeder` and `product-seeder` services with the `seed` profile.

1.  **Run the seeders (ensure all services are up and healthy first):**
    ```bash
    docker-compose --profile seed up --build --abort-on-container-exit
    ```
    This will run the seed scripts once and then exit the seeder containers. You should see logs indicating successful data insertion.

## API Documentation
API documentation is generated using JSDoc comments directly within the controller and route files.

**Example Endpoints:**

*   **Customer Service (Port 3001):**
    *   `POST /api/customers` - Create a new customer
    *   `GET /api/customers/:customerId` - Get customer by ID
    *   `GET /api/customers` - Get all customers

*   **Product Service (Port 3002):**
    *   `POST /api/products` - Create a new product
    *   `GET /api/products/:productId` - Get product by ID
    *   `GET /api/products` - Get all products
    *   `PUT /api/products/:productId/stock` - Update product stock

*   **Order Service (Port 3003):**
    *   `POST /api/orders` - Create a new order
    *   `GET /api/orders/:orderId` - Get order by ID
    *   `GET /api/orders/customer/:customerId` - Get all orders by customer ID

*   **Payment Service (Port 3004):**
    *   `POST /api/payments` - Process a payment

## Testing
Each service includes unit and integration tests using Jest and Supertest. 
To run tests for a specific service (e.g., Customer Service):

1.  **Navigate to the service directory:**
    ```bash
    cd services/customer-service
    ```

2.  **Run tests:**
    ```bash
    npm test
    ```
    Or, for watching changes during development:
    ```bash
    npm test -- --watch
    ```

**Specific Test Scenarios to Implement:**
- **Customer Service:**
  - Create customer (success, duplicate email, missing fields).
  - Get customer (success, not found).
  - Get all customers.
- **Product Service:**
  - Create product (success, duplicate product ID, missing fields).
  - Get product (success, not found).
  - Get all products.
  - Update stock (success, insufficient stock, product not found, invalid stock value).
- **Order Service (Integration/E2E):**
  - Successful order creation (valid customer/product, sufficient stock, payment initiated).
  - Order creation failure (customer not found, product not found, insufficient stock, payment service error).
  - Get order by ID (success, not found).
  - Get orders by customer ID.
- **Payment Service (Unit/Integration):**
  - Successful payment processing and RabbitMQ message publishing.
  - Payment processing failure (simulated, or RabbitMQ connection issues).
- **Queue Worker (Integration/E2E):**
  - Consume transaction message, update order status and product stock, save transaction.
  - Handle failed message processing with retry logic.
  - Verify eventual consistency after successful processing.

## Error Handling
Comprehensive error handling is implemented across all services:
- **400 Bad Request:** For invalid input or missing required fields.
- **404 Not Found:** For resources that do not exist.
- **500 Internal Server Error:** For unexpected server-side issues.
- **503 Service Unavailable:** For issues with dependent services.
- **Queue Connection Errors:** Implemented retry logic for RabbitMQ connections.

Custom error middleware (`errorHandler.js`) centralizes error responses.

## Folder Structure
```
ecommerce-microservices/
├── services/
│   ├── customer-service/
│   │   ├── src/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── middleware/
│   │   │   └── app.js
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   └── node_modules/
│   ├── product-service/ (same structure)
│   ├── order-service/ (same structure)
│   ├── payment-service/ (same structure)
│   └── queue-worker/
│       ├── src/
│       │   ├── models/
│       │   │   ├── order.js
│       │   │   ├── product.js
│       │   │   └── transaction.js
│       │   └── worker.js
│       ├── Dockerfile
│       ├── package.json
│       ├── package-lock.json
│       └── node_modules/
├── shared/ (For common utilities, configurations, etc. - currently empty but reserved)
│   ├── config/
│   ├── utils/
│   └── database/
├── seed/
│   ├── models/
│   │   ├── customer.js
│   │   └── product.js
│   ├── customer-seeder.js
│   ├── product-seeder.js
│   ├── Dockerfile.seed
│   ├── package.json
│   ├── package-lock.json
│   └── node_modules/
├── tests/
│   ├── unit/
│   └── integration/
├── docker-compose.yml
├── .env
└── README.md
```

## Communication Flow (Order Creation)
1.  Client sends `POST /api/orders` to Order Service.
2.  Order Service validates input, then calls:
    *   `GET /api/customers/:customerId` on Customer Service.
    *   `GET /api/products/:productId` on Product Service (to verify existence and stock).
3.  If customer and product are valid and stock is sufficient, Order Service creates a `pending` order in its database.
4.  Order Service then sends a `POST /api/payments` request to Payment Service.
5.  Payment Service simulates payment, generates a `transactionId`, and publishes transaction details (including `orderId`, `customerId`, `productId`, `amount`, `paymentStatus`) to `transaction_queue` on RabbitMQ.
6.  Payment Service responds to Order Service with payment confirmation (e.g., `transactionId`).
7.  Order Service responds to the client with the created order (still `pending` from its perspective until worker confirms).
8.  Queue Worker consumes the message from `transaction_queue`:
    *   Saves the transaction details to `transaction_db`.
    *   Updates the corresponding order's status to `completed` (or `failed`) in `order_db`.
    *   Decrements product stock in `product_db`.
    *   Implements retry logic for failed message processing.

## Troubleshooting
- **Services not starting:** Check `docker-compose logs` for specific error messages. Ensure all `MONGODB_URI` and `RABBITMQ_URI` are correctly configured in `.env` or `docker-compose.yml`.
- **RabbitMQ connection issues:** Verify RabbitMQ container is healthy and accessible. Check firewall settings.
- **MongoDB connection issues:** Verify MongoDB containers are healthy and accessible. Check port mappings and network configurations.
- **`npm install` failures:** Ensure Node.js version compatibility and correct `package.json` dependencies.
- **Inter-service communication:** Double-check service URLs in `docker-compose.yml` (using service names, not `localhost`) and `.env` (using `localhost` for local dev).

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
ISC
