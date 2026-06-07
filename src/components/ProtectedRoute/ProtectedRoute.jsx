// components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const user = localStorage.getItem("user") || sessionStorage.getItem("user");
  const role = user ? JSON.parse(user).role : null;
  console.log("ProtectedRoute - User Role:", role, "Allowed Roles:", allowedRoles);

  if (!role) {
    return <Navigate to="/login" />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/" />; // or unauthorized page
  }

  return children;
};

export default ProtectedRoute;