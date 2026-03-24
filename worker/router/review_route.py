from fastapi import APIRouter
from ..repository.reviewRepo import (
    create_review,
    find_reviews_by_worker,
    calculate_average_rating, find_reviews_by_customer
)

router = APIRouter(tags=["Reviews"])


# Create a review
@router.post("/reviews")
def add_review(review: dict):
    result = create_review(review)
    return {
        "message": "Review added successfully",
        "review_id": str(result.inserted_id)
    }


# Get all reviews for a worker
@router.get("/reviews/worker/{workerId}")
def get_reviews(workerId: str):
    reviews = find_reviews_by_worker(workerId)
    return reviews


# Get average rating of a worker
@router.get("/reviews/worker/{workerId}/rating")
def get_worker_rating(workerId: str):
    avg = calculate_average_rating(workerId)
    return {
        "workerId": workerId,
        "average_rating": avg
    }

@router.get("/reviews/customer/{customer_id}")
def get_reviews_by_customer(customer_id: str):
    reviews = find_reviews_by_customer(customer_id)
    return reviews