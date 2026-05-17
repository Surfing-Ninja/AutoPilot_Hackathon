#!/usr/bin/env python3
"""
Database seeding script.
Populates the database with initial sample data.
Used by the seed-db Cloud Run Job.
"""

import logging
import os
import sys

# Configure logging for scripts
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import sessionmaker

from app.core.database import engine
from app.models.item import Item
from app.models.orchestration import ExecutionContext, WorkbenchItem
import uuid

# Create a new session for this script
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def seed_data():
    """Populates the database with initial data."""
    db = SessionLocal()
    try:
        log.info("Seeding initial data...")

        # Check if items already exist
        if db.query(Item).count() == 0:
            log.info("Adding sample items...")
            item1 = Item(
                name="First Sample Item",
                description="This is a test item from the seeder.",
            )
            item2 = Item(
                name="Second Sample Item",
                description="Another test item for demonstration.",
            )
            db.add_all([item1, item2])
            db.commit()
            log.info("Sample items added.")
        else:
            log.info("Items table is not empty, skipping seeding.")

        # Check if execution contexts already exist
        if db.query(ExecutionContext).count() == 0:
            log.info("Adding sample execution contexts and workbench items...")
            
            # Context 1
            ctx1 = ExecutionContext(
                id=str(uuid.uuid4()),
                company_name="Orion Retail Technologies Ltd",
                system_command="ROUTE_TO_WORKBENCH",
                unified_risk_score=0.88,
                trace={
                    "total_latency_ms": 1420.5,
                    "steps": [
                        {"agent": "Web Intel", "status": "success", "latency_ms": 320.0, "result": "Verified Orion Retail Ltd: Active, Category Tier 1 Retailer."},
                        {"agent": "Comms Intel", "status": "success", "latency_ms": 410.0, "result": "Sentiment parsed: High frustration, high urgency thread."},
                        {"agent": "OCR/Doc Parsing", "status": "success", "latency_ms": 690.0, "result": "Extracted contract sections: MSA, Value USD 185,000. Missing client signature for Michael Carter."},
                        {"agent": "Risk Assessor", "status": "success", "latency_ms": 120.0, "result": "Risk assessment complete. Flagged high-urgency combined with unsigned MSA."},
                        {"agent": "RAG Policy/Governance", "status": "success", "latency_ms": 80.0, "result": "Governance check: Missing mandatory signature (Michael Carter)."}
                    ]
                },
                agent_results={
                    "web_intel": "Verified Orion Retail Ltd: Active, Category Tier 1 Retailer.",
                    "comms_intel": "Sentiment parsed: High frustration, high urgency thread.",
                    "ocr_parsing": "Extracted contract sections: MSA, Value USD 185,000. Missing client signature for Michael Carter.",
                    "risk_assessment": "Risk assessment complete. Flagged high-urgency combined with unsigned MSA.",
                    "rag_policy": "Governance check: Missing mandatory signature (Michael Carter)."
                }
            )
            
            # Workbench Item 1
            wb1 = WorkbenchItem(
                id=str(uuid.uuid4()),
                execution_context_id=ctx1.id,
                company_name="Orion Retail Technologies Ltd",
                status="pending",
                risk_factors=["High Client Frustration", "Missing Client Signature"],
                missing_fields=["Signature (Michael Carter)"]
            )
            
            # Context 2
            ctx2 = ExecutionContext(
                id=str(uuid.uuid4()),
                company_name="Apex Global Solutions Inc",
                system_command="ROUTE_TO_WORKBENCH",
                unified_risk_score=0.92,
                trace={
                    "total_latency_ms": 1580.0,
                    "steps": [
                        {"agent": "Web Intel", "status": "success", "latency_ms": 400.0, "result": "Verified Apex Global Solutions: Active, US East Division."},
                        {"agent": "Comms Intel", "status": "success", "latency_ms": 380.0, "result": "Sentiment parsed: Normal discussion, but payment terms change requested."},
                        {"agent": "OCR/Doc Parsing", "status": "success", "latency_ms": 800.0, "result": "Extracted contract sections: Service Agreement, Value USD 450,000. Payment terms altered from Net 30 to Net 90 without authorization."},
                        {"agent": "Risk Assessor", "status": "success", "latency_ms": 150.0, "result": "Risk assessment complete. Flagged unauthorized Net 90 payment terms."},
                        {"agent": "RAG Policy/Governance", "status": "success", "latency_ms": 90.0, "result": "Governance check: Payment term modifications exceed standard Net 30 limit."}
                    ]
                },
                agent_results={
                    "web_intel": "Verified Apex Global Solutions: Active, US East Division.",
                    "comms_intel": "Sentiment parsed: Normal discussion, but payment terms change requested.",
                    "ocr_parsing": "Extracted contract sections: Service Agreement, Value USD 450,000. Payment terms altered from Net 30 to Net 90 without authorization.",
                    "risk_assessment": "Risk assessment complete. Flagged unauthorized Net 90 payment terms.",
                    "rag_policy": "Governance check: Payment term modifications exceed standard Net 30 limit."
                }
            )
            
            # Workbench Item 2
            wb2 = WorkbenchItem(
                id=str(uuid.uuid4()),
                execution_context_id=ctx2.id,
                company_name="Apex Global Solutions Inc",
                status="pending",
                risk_factors=["Unauthorized Payment Terms Modification (Net 90)"],
                missing_fields=["Executive Approval Signature (CFO)"]
            )
            
            db.add_all([ctx1, wb1, ctx2, wb2])
            db.commit()
            log.info("Sample execution contexts and workbench items added.")
        else:
            log.info("Execution contexts table is not empty, skipping seeding.")

        log.info("✅ Data seeding complete.")

    except Exception as e:
        log.error(f"❌ An error occurred during data seeding: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    log.info("--- Starting Database Seeding ---")
    seed_data()
