// components/SenderProtectedRoute.jsx
import { Navigate, useParams } from "react-router-dom";

const SenderProtectedRoute = ({ children }) => {
  const { senderId } = useParams();
  const currentUser = localStorage.getItem("user") || sessionStorage.getItem("user");
  const currentUserObj = currentUser ? JSON.parse(currentUser) : null;
  const currentUserId = currentUserObj?.id || currentUserObj?._id; // pick the ID, not email
  
  if (!currentUserId) {
    return <Navigate to="/login" />;
  }

  if (currentUserId !== senderId) {
    return <Navigate to="/" />; // block access
  }

  return children;
};

export default SenderProtectedRoute;