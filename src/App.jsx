import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { initForegroundListener } from './api/firebase'; 
import Login from './pages/Login/Login';
import ServiceRegistration from './pages/ServiceRegistration/ServiceRegistration';
import CustomerRegistration from './pages/CustomerRegistration/CustomerRegistration';
import TaskBookingUI from './pages/HomePage/homePage'
import WorkerDescription from './pages/WorkerDescription/WorkerDescription';
import TaskBookingPage from './pages/TaskRequest/TaskRequest';
import ChatPage from './pages/ChatMessage/ChatMessage';
import TaskListPage from "./pages/RequestsPage/RequestPage";
import WorkerList from "./pages/WorkerList/WorkerList1";
import LandingPage from "./pages/LandingPage/LandingPage"
import MessagePage  from "./components/MessageBox/MessageBox"
import  ChatPopUp from "./pages/ChatMessage/ChatMessage"
import TaskDescriptionPage  from './pages/TaskDescription/TaskDescription';
import HelpSection from './components/HelpSection/HelpSection'
import DashboardOverview from './pages-worker/Dashboard'
import WorkerRequestPage from './pages-worker/WorkerRequestPage'
import { TaskDetails } from './pages-worker/taskDetails';
import PaymentFlow from './components/payment/Payment';
import EarningDashboard from './pages-worker/Earning';
import Overview from './pages-worker/Overview';
import Tasks from './pages-worker/Task'
import CalendarAvailability from './pages-worker/Calendar';
import AdminDashboard from './pages/admin/admin-dashboard'
import Reviews from './pages-worker/Reviews';
import PaymentVerifyRedirect from './components/payment/PaymentRedirect';
import AdminPayoutDashboard from './pages/admin/AdminPayoutDashboard';
import WorkerVerification from './pages/admin/workerVerification';
import CustomerProfile    from './pages/customerProfile';
import Notification from './components/Notification';
import CompleteProfile from './components/CompleteProfile/CompleteProfile';
import RefundManagement from './pages/admin/RefundManagement';
import WorkerSettings from './pages-worker/workerProfile';
import FraudDashboard from './pages/admin/FraudDetectionBoard';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import SenderProtectedRoute from './components/ProtectedRoute/SenderProtectedRoute';
import TermsAndCondition from './components/TermsAndCondition/TermsAndCondition'

initForegroundListener();
function App() {
  return (
    <div>
      <Notification /> {/* Mount the notification handler once at the app level */}
    <Router>

      <div className="App">
        <Routes>

          <Route path="/" element={<LandingPage />} />
          <Route path="/customer/pay/:taskId/:userId/:role" element={
    <ProtectedRoute allowedRoles={["customer"]}>
      <PaymentFlow />
    </ProtectedRoute>
  } />
  <Route path="/terms" element={<TermsAndCondition/>}/>
          <Route path="/login" element={<Login />} />
          <Route path="/register-worker" element={<ServiceRegistration />} />
          <Route path="/register-customer" element={<CustomerRegistration />} />
          <Route path="/home" element={<TaskBookingUI />} />
          <Route path="/workers/:id" element={
    <ProtectedRoute allowedRoles={["customer"]}>
      <WorkerDescription />
    </ProtectedRoute>
  }/>
          <Route path="/task/:id" element={
    <ProtectedRoute allowedRoles={["customer"]}>
      <TaskBookingPage />
    </ProtectedRoute>
  }/>
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/complete-profile" element={<CompleteProfile/>} />
<Route
  path="/chat/:senderId/:recieverId"
  element={
    <SenderProtectedRoute>
      <MessagePage />
    </SenderProtectedRoute>
  }
/>

<Route
  path="/chat/:senderId"
  element={
    <SenderProtectedRoute>
      <MessagePage />
    </SenderProtectedRoute>
  }
/>
<Route path="/fraud" element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <FraudDashboard />
    </ProtectedRoute>
  }/>

          <Route path="/refund" element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <RefundManagement />
    </ProtectedRoute>
  }/>
         <Route path="/tasks/user/:id" element={<TaskListPage/>} />
         <Route path="/task-request" element={<TaskBookingPage />} />
         <Route path="/workerList" element={
    <ProtectedRoute allowedRoles={["customer"]}>
      <WorkerList />
    </ProtectedRoute>
  } />
          <Route path="/helpSection" element={<HelpSection/>}/>
         <Route path="/taskDescription"element={
    <ProtectedRoute allowedRoles={["customer"]}>
      <TaskDescriptionPage />
    </ProtectedRoute>
  } />
         <Route path="/worker/taskDetails" element={<TaskDetails/>}/>
         <Route path="/workerRequestPage/:workerId" element={
    <ProtectedRoute allowedRoles={["worker"]}>
      <WorkerRequestPage />
    </ProtectedRoute>
  } />
         <Route path = "/worker/dashboard/reviews/:workerId" element={
    <ProtectedRoute allowedRoles={["worker"]}>
      <Reviews />
    </ProtectedRoute>
  } />

         <Route path="/worker/dashboard/overview/:workerId" element={
    <ProtectedRoute allowedRoles={["worker"]}>
      <DashboardOverview />
    </ProtectedRoute>
  } />

         <Route path="/worker/dashboard/earning/:workerId" element={
    <ProtectedRoute allowedRoles={["worker"]}>
      <EarningDashboard />
    </ProtectedRoute>
  } />

         <Route path="/worker/dashboard/task/:workerId" element={
    <ProtectedRoute allowedRoles={["worker"]}>
      <Tasks />
    </ProtectedRoute>
  } />

         <Route path="/worker/calendar/:workerId" element={
    <ProtectedRoute allowedRoles={["worker"]}>
      <CalendarAvailability />
    </ProtectedRoute>
  } />
        

<Route path="/admin/payouts" element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminPayoutDashboard />
    </ProtectedRoute>
  }/>
<Route path="/customer/pay/:taskId/:workerId/:customerId/:role" element={<PaymentFlow />} />
<Route path="/customer/pay/:taskId" element={<PaymentVerifyRedirect />} />
<Route path="/workerVerification" element={<WorkerVerification />} />
         <Route path="/admin/dashboard" element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminDashboard />
    </ProtectedRoute>
  }/>
<Route path="/profile/:id"                   element={
    <ProtectedRoute allowedRoles={["customer"]}>
      <CustomerProfile />
    </ProtectedRoute>
  } />
<Route path="/worker/profile/:id"            element={
    <ProtectedRoute allowedRoles={["worker"]}>
      <WorkerSettings />
    </ProtectedRoute>
  }/>
{/*<Route path="/admin/settings"                 element={<AdminSettings />} /> */}
        </Routes>
      </div>
    </Router>
    </div>
  );
}

export default App;