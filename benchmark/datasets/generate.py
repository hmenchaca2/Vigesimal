"""
Generate all 6 benchmark datasets and save them as JSON files.
Uses a fixed random seed (42) for full reproducibility.
"""

import json
import random
from pathlib import Path
from datetime import date, timedelta

random.seed(42)

OUTPUT_DIR = Path(__file__).parent


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

FIRST_NAMES = [
    "Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Hank",
    "Iris", "Jack", "Karen", "Leo", "Mia", "Nate", "Olivia", "Paul",
    "Quinn", "Rachel", "Sam", "Tina", "Uma", "Victor", "Wendy", "Xander",
    "Yara", "Zoe", "Aaron", "Beth", "Chris", "Diana", "Ethan", "Fiona",
    "George", "Helen", "Ivan", "Julia", "Kevin", "Laura", "Mark", "Nina",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Wilson", "Anderson", "Taylor", "Thomas", "Hernandez", "Moore",
    "Martin", "Jackson", "Thompson", "White", "Lopez", "Lee", "Harris",
    "Clark", "Lewis", "Robinson", "Walker", "Hall", "Allen", "Young",
    "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
    "Green", "Adams", "Nelson", "Baker", "Carter", "Mitchell", "Perez",
]

PRODUCT_NAMES = [
    ("Laptop Pro 15", "Electronics"), ("Wireless Earbuds", "Electronics"),
    ("Smart Watch", "Electronics"), ("USB-C Hub", "Electronics"),
    ("Mechanical Keyboard", "Electronics"), ("4K Monitor", "Electronics"),
    ("Running Shoes", "Sports"), ("Yoga Mat", "Sports"),
    ("Dumbbell Set", "Sports"), ("Cycling Helmet", "Sports"),
    ("Water Bottle", "Sports"), ("Resistance Bands", "Sports"),
    ("T-Shirt", "Clothing"), ("Denim Jeans", "Clothing"),
    ("Hoodie", "Clothing"), ("Winter Jacket", "Clothing"),
    ("Sneakers", "Clothing"), ("Dress Shirt", "Clothing"),
    ("Python Cookbook", "Books"), ("Design Patterns", "Books"),
    ("Clean Code", "Books"), ("The Pragmatic Programmer", "Books"),
    ("Data Structures", "Books"), ("Machine Learning Guide", "Books"),
    ("Coffee Maker", "Home"), ("Air Purifier", "Home"),
    ("Desk Lamp", "Home"), ("Throw Pillow Set", "Home"),
    ("Storage Organizer", "Home"), ("Bamboo Cutting Board", "Home"),
]

REPO_NAMES = [
    "react-query", "fastapi-utils", "go-microservices", "rust-actix-demo",
    "typescript-starter", "ml-pipeline", "data-validator", "auth-service",
    "event-bus", "cache-proxy", "api-gateway", "log-aggregator",
    "schema-registry", "task-scheduler", "rate-limiter", "config-loader",
    "retry-lib", "circuit-breaker", "health-checker", "metrics-exporter",
    "feature-flags", "dark-mode-toggle", "form-builder", "chart-library",
    "cli-tools", "db-migrator", "seed-generator", "test-helpers",
    "mock-server", "load-tester", "perf-profiler", "memory-tracker",
    "image-resizer", "pdf-generator", "csv-parser", "json-diff",
    "yaml-validator", "env-inspector", "secret-manager", "token-refresher",
    "session-store", "audit-logger", "notification-hub", "email-sender",
    "webhook-dispatcher", "batch-processor", "stream-consumer", "queue-worker",
    "cron-runner", "deploy-bot", "release-drafter", "changelog-gen",
    "dependency-updater", "security-scanner", "code-formatter", "doc-builder",
    "api-docs", "type-generator", "proto-compiler", "graphql-schema",
    "rest-client", "grpc-gateway", "ws-server", "sse-broadcaster",
    "oauth-proxy", "saml-provider", "mfa-service", "rbac-engine",
    "tenant-manager", "billing-api", "invoice-generator", "payment-router",
    "subscription-handler", "usage-tracker", "quota-enforcer", "cost-estimator",
    "search-indexer", "recommendation-engine", "vector-store", "embedding-service",
    "llm-router", "prompt-cache", "context-compressor", "eval-harness",
    "ab-tester", "experiment-runner", "cohort-analyzer", "funnel-tracker",
    "heatmap-collector", "replay-recorder", "crash-reporter", "alert-dispatcher",
    "on-call-scheduler", "runbook-bot", "postmortem-gen", "slo-monitor",
    "uptime-tracker", "synthetic-monitor", "trace-sampler", "span-collector",
]

LOG_MESSAGES = {
    "api": {
        "INFO": ["Request received for {}", "Response sent: 200 OK", "Route matched: {}", "Middleware applied"],
        "WARN": ["Slow response detected on {}", "Rate limit approaching for client", "Deprecated endpoint called"],
        "ERROR": ["Unhandled exception in route {}", "Request validation failed", "Upstream timeout"],
    },
    "auth": {
        "INFO": ["User login successful", "Token issued for user", "Session refreshed", "User logout recorded"],
        "WARN": ["Failed login attempt", "Token near expiry", "Unusual login location detected"],
        "ERROR": ["Invalid token signature", "Session store unavailable", "OAuth callback failed"],
    },
    "db": {
        "INFO": ["Query executed in {}ms", "Connection pool healthy", "Migration applied", "Index rebuilt"],
        "WARN": ["Query took {}ms — consider optimizing", "Connection pool near limit", "Replication lag detected"],
        "ERROR": ["Query failed: deadlock detected", "Connection pool exhausted", "Disk space low"],
    },
    "cache": {
        "INFO": ["Cache hit: {}", "Cache populated: {}", "Eviction policy applied", "TTL reset"],
        "WARN": ["Cache miss rate elevated", "Memory usage at 80%", "Eviction count increasing"],
        "ERROR": ["Cache connection lost", "Serialization error", "OOM — evicting all keys"],
    },
    "worker": {
        "INFO": ["Job {} started", "Job {} completed", "Queue depth: {}", "Worker heartbeat OK"],
        "WARN": ["Job retry #{}", "Queue depth elevated", "Worker slow — {}ms per job"],
        "ERROR": ["Job {} failed after max retries", "Worker crash detected", "Dead letter queue overflow"],
    },
}


def random_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


def random_date(start: date, days: int) -> str:
    return (start + timedelta(days=random.randint(0, days))).isoformat()


# ---------------------------------------------------------------------------
# 1. employee_records  (100 rows)
# ---------------------------------------------------------------------------

def generate_employee_records():
    departments = ["Engineering", "Sales", "Marketing", "HR", "Finance"]
    roles = ["Junior", "Senior", "Lead", "Manager"]
    locations = ["NYC", "SF", "Austin", "Chicago", "Remote"]

    records = []
    for i in range(1, 101):
        dept = random.choice(departments)
        role = random.choice(roles)
        seniority = random.randint(1, 20)
        # salary loosely correlated with role index and seniority
        role_idx = roles.index(role)
        base = 50000 + role_idx * 15000 + seniority * 1500
        salary = base + random.randint(-5000, 5000)
        salary = max(50000, min(150000, salary))

        records.append({
            "id": i,
            "name": random_name(),
            "department": dept,
            "role": role,
            "seniority_years": seniority,
            "location": random.choice(locations),
            "salary": salary,
            "active": random.random() > 0.1,
        })
    return records


# ---------------------------------------------------------------------------
# 2. ecommerce_orders  (50 rows)
# ---------------------------------------------------------------------------

def generate_ecommerce_orders():
    statuses = ["pending", "shipped", "delivered", "cancelled"]
    start = date(2024, 1, 1)
    orders = []
    for i in range(1, 51):
        product, category = random.choice(PRODUCT_NAMES)
        quantity = random.randint(1, 5)
        unit_price = round(random.uniform(9.99, 499.99), 2)
        total_price = round(quantity * unit_price, 2)
        orders.append({
            "order_id": f"ORD-{1000 + i}",
            "customer_name": random_name(),
            "product_name": product,
            "category": category,
            "quantity": quantity,
            "unit_price": unit_price,
            "total_price": total_price,
            "status": random.choice(statuses),
            "created_at": random_date(start, 364),
        })
    return orders


# ---------------------------------------------------------------------------
# 3. time_series  (60 days)
# ---------------------------------------------------------------------------

def generate_time_series():
    start = date(2024, 3, 1)
    records = []
    page_views = 10000
    for i in range(60):
        page_views = max(1000, page_views + random.randint(-500, 800))
        clicks = int(page_views * random.uniform(0.05, 0.15))
        conversions = int(clicks * random.uniform(0.02, 0.12))
        revenue = round(conversions * random.uniform(25.0, 120.0), 2)
        bounce_rate = round(random.uniform(0.25, 0.75), 4)
        records.append({
            "date": (start + timedelta(days=i)).isoformat(),
            "page_views": page_views,
            "clicks": clicks,
            "conversions": conversions,
            "revenue": revenue,
            "bounce_rate": bounce_rate,
        })
    return records


# ---------------------------------------------------------------------------
# 4. github_repos  (100 repos)
# ---------------------------------------------------------------------------

def generate_github_repos():
    languages = ["Python", "JavaScript", "Go", "Rust", "TypeScript"]
    owners = ["acme-corp", "devtools-io", "open-source-labs", "tech-hub", "codesmith"]

    repos = []
    for i, name in enumerate(REPO_NAMES[:100], start=1):
        owner = random.choice(owners)
        stars = int(random.expovariate(1 / 500))
        forks = int(stars * random.uniform(0.1, 0.4))
        repos.append({
            "id": i,
            "name": name,
            "full_name": f"{owner}/{name}",
            "description": f"A {random.choice(['lightweight', 'fast', 'reliable', 'modern', 'minimal'])} {name.replace('-', ' ')} library",
            "stars": stars,
            "forks": forks,
            "language": random.choice(languages),
            "open_issues": random.randint(0, 50),
            "has_wiki": random.random() > 0.4,
            "archived": random.random() < 0.1,
        })
    return repos


# ---------------------------------------------------------------------------
# 5. event_logs  (75 events)
# ---------------------------------------------------------------------------

def generate_event_logs():
    services = ["api", "auth", "db", "cache", "worker"]
    levels = ["INFO", "WARN", "ERROR"]
    # weighted: INFO 60%, WARN 25%, ERROR 15%
    level_weights = [0.60, 0.25, 0.15]

    start_ts = 1_700_000_000  # Unix epoch, Nov 2023
    events = []
    ts = start_ts
    for i in range(1, 76):
        ts += random.randint(30, 600)
        service = random.choice(services)
        level = random.choices(levels, weights=level_weights)[0]
        msg_templates = LOG_MESSAGES[service][level]
        template = random.choice(msg_templates)
        # fill in placeholder if present
        placeholder = random.choice(["endpoint /users", "job-42", "key:user:session", "120"])
        message = template.replace("{}", placeholder)
        duration = random.randint(1, 3000) if level != "ERROR" else random.randint(500, 8000)
        events.append({
            "event_id": f"EVT-{i:04d}",
            "timestamp": ts,
            "level": level,
            "service": service,
            "message": message,
            "duration_ms": duration,
            "success": level != "ERROR",
        })
    return events


# ---------------------------------------------------------------------------
# 6. config  (single dict)
# ---------------------------------------------------------------------------

def generate_config():
    return {
        "database": {
            "host": "db.internal.example.com",
            "port": 5432,
            "name": "app_production",
            "pool_size": 20,
            "ssl": True,
        },
        "cache": {
            "host": "redis.internal.example.com",
            "port": 6379,
            "ttl": 3600,
            "max_size": 512,
        },
        "api": {
            "base_url": "https://api.example.com/v2",
            "timeout": 30,
            "retry_count": 3,
            "rate_limit": 1000,
        },
        "features": {
            "enable_search": True,
            "enable_analytics": False,
            "enable_notifications": True,
            "max_upload_mb": 50,
        },
    }


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

GENERATORS = [
    ("employee_records", generate_employee_records),
    ("ecommerce_orders", generate_ecommerce_orders),
    ("time_series", generate_time_series),
    ("github_repos", generate_github_repos),
    ("event_logs", generate_event_logs),
    ("config", generate_config),
]


def main():
    for name, generator in GENERATORS:
        data = generator()
        out_path = OUTPUT_DIR / f"{name}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        # summary
        if isinstance(data, list):
            record_count = len(data)
            sample_fields = list(data[0].keys()) if data else []
            print(f"  {name}: {record_count} records | fields: {', '.join(sample_fields)}")
        else:
            # config dict — show top-level keys and their child key counts
            summary = {k: list(v.keys()) for k, v in data.items()}
            total_keys = sum(len(v) for v in data.values())
            print(f"  {name}: 1 config object | {total_keys} total keys | "
                  f"sections: {', '.join(data.keys())}")

        print(f"    -> saved to {out_path}")


if __name__ == "__main__":
    print("Generating datasets...\n")
    main()
    print("\nDone.")
