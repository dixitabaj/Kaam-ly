import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  return (
    <div>
      <Notification /> {/* Mount the notification handler once at the app level */}
    <Router>

      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register-worker" element={<ServiceRegistration />} />
          <Route path="/register-customer" element={<CustomerRegistration />} />
          <Route path="/home" element={<TaskBookingUI />} />
          <Route path="/workers/:id" element={<WorkerDescription />} />
          <Route path="/task/:id" element={<TaskBookingPage/>} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/complete-profile" element={<CompleteProfile/>} />
<Route path="/chat/:senderId/:recieverId" element={<MessagePage />} />
<Route path="/chat/:senderId" element={<MessagePage />} />
         <Route path="/tasks/user/:id" element={<TaskListPage/>} />
         <Route path="/task-request" element={<TaskBookingPage />} />
         <Route path="/workerList" element={<WorkerList />} />
          <Route path="/helpSection" element={<HelpSection/>}/>
         <Route path="/taskDescription" element={<TaskDescriptionPage />} />
         <Route path="/worker/taskDetails" element={<TaskDetails/>}/>
         <Route path="/workerRequestPage/:workerId" element={<WorkerRequestPage />} />
         <Route path = "/worker/dashboard/reviews/:workerId" element={<Reviews/>}/>

         <Route path="/worker/dashboard/overview/:workerId" element={<DashboardOverview />} />

         <Route path="/worker/dashboard/earning/:workerId" element={<EarningDashboard />} />

         <Route path="/worker/dashboard/task/:workerId" element={<Tasks/>} />

         <Route path="/worker/calendar/:workerId" element={<CalendarAvailability/>} />
        

<Route path="/admin/payouts" element={<AdminPayoutDashboard />} />
<Route path="/customer/pay/:taskId/:workerId/:customerId/:role" element={<PaymentFlow />} />
<Route path="/customer/pay/:taskId" element={<PaymentVerifyRedirect />} />
<Route path="/workerVerification" element={<WorkerVerification />} />

         <Route path="/admin/dashboard" element={<AdminDashboard />} />


         

<Route path="/profile/:id"                    element={<CustomerProfile />} />
{/* <Route path="/worker/profile/:id"             element={<WorkerSettings />} />
<Route path="/admin/settings"                 element={<AdminSettings />} /> */}
        </Routes>
      </div>
    </Router>
    </div>
  );
}

export default App;