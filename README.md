# Kaam-ly

Kaam-ly is a web-based service marketplace platform designed to bridge the gap between customers seeking local services and skilled workers in Nepal. The word "Kaam" translates to "work" in Nepali, reflecting the platform's core mission.

The platform addresses unemployment, limited worker visibility, and market inefficiencies in Nepal's informal labor sector by providing a centralized digital marketplace where workers can manage profiles, showcase services, and gain visibility — while customers can browse, compare, and book services directly.

---

## Problem Statement

- Hiring local workers in Nepal relies on word-of-mouth, referrals, and informal advertisements
- Workers lack visibility beyond their immediate community, limiting income opportunities
- Customers cannot easily compare options or verify worker credentials
- No transparent, reliable system exists for booking, payment, or dispute resolution

---

## Features

| Feature | Description |
|---|---|
| Face Verification | Identity verification for workers using DeepFace model |
| Smart Search | Hybrid search using natural language queries and image-based task classification |
| Recommendation System | Personalized worker recommendations using LinUCB algorithm |
| Booking Management | End-to-end booking request system for customers and workers |
| In-App Messaging | Real-time chat between customers and workers |
| Ratings and Reviews | Post-service rating system to build trust |
| Fraud Detection | Rule-based system flagging fake accounts, rating spikes, cancellation spikes, and IP hopping |
| Skill Verification | Workers upload certifications validated by admins |
| Escrow Payment | Secure payment via eSewa and Khalti with escrow-based release |
| Admin Dashboard | Platform management, worker verification, dispute resolution |
| Worker Portfolio | Workers can showcase skills, experience, and service areas |
| Availability Management | Workers set and update their availability calendar |
| Cancellation and Refund System | Defined rules for cancellations and automated refund handling |
| Notification System | Real-time alerts for bookings, payments, and status updates |
| AI Chatbot | In-app assistant for customer and worker support |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js |
| Backend | Python, FastAPI |
| Database | MongoDB |
| Face Verification | DeepFace |
| Recommendation | LinUCB (contextual bandit) |
| Smart Search | NLP-based intent mapping + image classification |
| Fraud Detection | Rule-based scoring system |
| Payments | eSewa, Khalti |
| Real-time Messaging | WebSockets |
| Methodology | Scrum (11 sprints) |

---

## Development Methodology

Built using **Scrum** across 11 sprints, covering:

1. Authentication and face verification
2. Booking system
3. Recommendation system and fraud classification
4. In-app messaging
5. Reviews and ratings
6. Portfolio management
7. Payment integration (eSewa, Khalti, worker payouts)
8. Report and refund system
9. Calendar and availability management
10. Fraud detection
11. AI chatbot and admin review system

---

## Author

Dixita Bajracharya — CS6P05NI Final Year Project, BSc Computer Science
