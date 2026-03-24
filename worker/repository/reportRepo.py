from datetime import datetime
from bson import ObjectId
from typing import Optional

def _serialize(report: dict) -> dict:
    """Convert _id to string id."""
    if not report: return None
    report["id"] = str(report["_id"])
    del report["_id"]
    return report

class ReportRepo:
    def __init__(self, collection):
        self.col = collection

    def createReport(self, data: dict, evidence_url: Optional[str] = None) -> dict:
        doc = {
            "reporterId":   data.get("reporterId"),
            "reporterType": data.get("reporterType"),
            "reportedId":   data.get("reportedId"),
            "reportedType": data.get("reportedType"),
            "reason":       data.get("reason"),
            "description":  data.get("description") or "",
            "evidenceUrl":  evidence_url,  # Path to the uploaded image
            "status":       "pending",
            "createdAt":    datetime.utcnow(),
            "resolvedAt":   None,
            "adminNote":    "",
        }
        result = self.col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        if "_id" in doc: del doc["_id"]
        return doc

    def getReports(self, skip=0, limit=50, status=None, reporterType=None, reportedType=None, search=""):
        query = {}
        if status and status != "all": query["status"] = status
        if reporterType and reporterType != "all": query["reporterType"] = reporterType
        if reportedType and reportedType != "all": query["reportedType"] = reportedType
        
        if search and search.strip():
            s = search.strip()
            query["$or"] = [
                {"reporterId": {"$regex": s, "$options": "i"}},
                {"reportedId": {"$regex": s, "$options": "i"}},
                {"reason": {"$regex": s, "$options": "i"}},
            ]
        
        total = self.col.count_documents(query)
        cursor = self.col.find(query).sort("createdAt", -1).skip(skip).limit(limit)
        return {
            "reports": [_serialize(r) for r in cursor],
            "total": total,
            "hasMore": (skip + limit) < total,
        }

    def getReportById(self, report_id: str):
        try:
            report = self.col.find_one({"_id": ObjectId(report_id)})
            return _serialize(report)
        except: return None

    def updateReportStatus(self, report_id: str, status: str, adminNote: str = ""):
        update = {
            "$set": {
                "status": status,
                "adminNote": adminNote,
                "resolvedAt": datetime.utcnow() if status in ("resolved", "declined") else None,
            }
        }
        result = self.col.update_one({"_id": ObjectId(report_id)}, update)
        return result.modified_count > 0

    def getStats(self):
        return {
            "total": self.col.count_documents({}),
            "pending": self.col.count_documents({"status": "pending"}),
            "resolved": self.col.count_documents({"status": "resolved"}),
            "declined": self.col.count_documents({"status": "declined"}),
        }
    
    def getReportsByUserId(self, user_id: str):
        reports = list(self.col.find({"reporterId": user_id}).sort("createdAt", -1))
        return [_serialize(r) for r in reports]
    
    def getReportedUsers(self):
        return self.col.distinct("reportedId", {})