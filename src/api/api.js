const BASE_URL = "http://localhost:8000/api";

// api/api.js


// Helper function for API calls
 const apiCall = async (endpoint, options = {}) => {

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
};

// Check if email already exists
export const checkEmailExists = async (email) => {
  try {
    const data = await apiCall(`/api/checkEmailExists?email=${encodeURIComponent(email)}`);
    return data.exists; // assuming API returns { exists: true/false }
  } catch (error) {
    console.error('Error checking email:', error);
    throw error;
  }
};

// Check if phone already exists
export const checkPhoneExists = async (phone) => {
  try {
    const data = await apiCall(`/api/checkCusPhone?phoneNo=${encodeURIComponent(phone)}`);
    console.log("Phone check response:", data);
    return data.exists; // assuming API returns { exists: true/false }
  } catch (error) {
    console.error('Error checking phone:', error);
    throw error;
  }
};

// Send verification code to email
export const sendVerificationCode = async (email) => {
  try {
    const data = await apiCall('/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return data;
  } catch (error) {
    console.error('Error sending verification code:', error);
    throw error;
  }
};

// Verify email code
export const verifyEmailCode = async (email, code) => {
  try {
    const response = await fetch("http://127.0.0.1:8000/api/verify-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        otp: code,
      }),
    });
    
    const data = await response.json();
    console.log(data);
    const valid=true;
    return valid;
  } catch (error) {
    console.error('Error verifying code:', error);
    throw error;
  }
};


// Register customer
export const registerCustomer = async (customerData) => {
  try {
    const data = await apiCall('/customer', {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
    return data;
  } catch (error) {
    console.error('Error registering customer:', error);
    throw error;
  }
};

export const fetchCustomerById= async (customerId) => {
  try {
    const res = await fetch(`http://localhost:8000/api/customer/${customerId}`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return data;  // this will be an array of matched tasks
  } catch (err) {
    console.error("Error fetching search recommendations:", err);
    return [];  // return empty array on error
  }
};

export const fetchAllCustomer= async () =>{
  try{
    const res=await fetch(`http://localhost:8000/api/customer/all`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" }
    })
    return await res.json()

  }
  catch (err){
    console.log("failed to load customers")
  }
}

export const fetchAllWorkers=async ()=>{
  try{
    const res=await fetch(`http://localhost:8000/api/workers/all`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" }
    })
    return await res.json()

  }
  catch (err){
    console.log("failed to load workers")
  }
}

export const registerWorker = async (data) => {
  const res = await fetch(`${BASE_URL}/worker`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to register worker');
  return await res.json();
};

export const loginUser = async (data) => {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Login failed');
  const result = await res.json();
  return result.access_token;
};

export const fetchWorkers = async () => {
   try {
    const res = await fetch(`http://localhost:8000/api/worker/${workerId}`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return data;  // this will be an array of matched tasks
  } catch (err) {
    console.error("Error fetching search recommendations:", err);
    return [];  // return empty array on error
  }
};


export const fetchWorkerById = async (workerId) => {
  try {
    const res = await fetch(`http://localhost:8000/api/worker/${workerId}`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return data;  // this will be an array of matched tasks
  } catch (err) {
    console.error("Error fetching search recommendations:", err);
    return [];  // return empty array on error
  }
};

export const getWorkerBySubcategory = async (category, subcategory) => {
  try {
    const encodedCategory = encodeURIComponent(category);
    const encodedSubcategory = encodeURIComponent(subcategory);
    const res = await fetch(`http://localhost:8000/api/worker/category/${encodedCategory}/subcategory/${encodedSubcategory}`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error fetching workers by subcategory:", err);
    return [];
  }
};
// api.js
export const createTask = async (formData) => {
  try {
    const response = await fetch(`${BASE_URL}/task`, {
      method: "POST",
      body: formData,  // pass directly, NO rebuilding
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (err) {
    console.error("Error storing task:", err);
    throw err;
  }
};



// api/chat.js

/**
 * Connect to WebSocket
 * @param {string} senderId
 * @param {string} receiverId
 * @param {function} onMessage - callback when message received
 */
// export const connectWebSocket = (senderId, receiverId, onMessage) => {
//   const roomId = `${senderId}/${receiverId}`;  // Create room_id as expected by backend
//   ws = new WebSocket(`ws://127.0.0.1:8000/ws/${roomId}`);  // FIXED: Use /ws/ instead of /api/chat/

//   ws.onopen = () => {
//     console.log("WebSocket connected to room:", roomId);
//   };

//   ws.onmessage = (event) => {
//     const data = JSON.parse(event.data);
//     if (onMessage) onMessage(data);
//   };

//   ws.onclose = () => {
//     console.log("WebSocket disconnected");
//   };

//   ws.onerror = (error) => {
//     console.error("WebSocket error:", error);
//   };
// };

// /**
//  * Send a message over WebSocket
//  * @param {string} message
//  */
// export const sendMessageWS = (senderId, receiverId, message) => {
//   if (!ws || ws.readyState !== WebSocket.OPEN) {
//     console.error("WebSocket is not connected");
//     return;
//   }

//   ws.send(JSON.stringify({
//     sender_id: senderId,
//     receiver_id: receiverId,
//     message: message
//   }));
// };

// export const saveMessages = async (message) => {
//   try {
//     const res = await fetch("http://localhost:8000/api/chat/send", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(message),
//     });

//     if (!res.ok) throw new Error("Failed to save message");

//     return await res.json();
//   } catch (err) {
//     console.error(err);
//   }
// };

// export const fetchMessages = async (userId, workerId) => {
//   try {
//     const res = await fetch(`http://localhost:8000/api/chat/history/${userId}/${workerId}`);
//     if (!res.ok) throw new Error('Failed to fetch messages');
//     return await res.json();
//   } catch (err) {
//     console.error(err);
//     return [];
//   }
// };
// export const closeWebSocket = () => {
//   if (ws) {
//     ws.close();
//     ws = null;
//   }
// };

// WebSocket connection


 
// -----------------------------
// CONNECT WEBSOCKET
// /ws/{sender_id}/{receiver_id}
// -----------------------------
let ws = null;
let messageHandler = null;

 
// ─── CHAT: now all task-based ─────────────────────────────────────────────────
 
export const connectWebSocket = (senderId, receiverId, onMessage) => {
  messageHandler = onMessage;
 
  const room = [senderId, receiverId].sort().join("__");
 
  // if already connected to the same room, just update handler
  if (ws && ws.readyState === WebSocket.OPEN && ws._room === room) return;
 
  if (ws) { ws.close(); ws = null; }
 
  ws = new WebSocket(
    `ws://127.0.0.1:8000/api/ws/${encodeURIComponent(senderId)}/${encodeURIComponent(receiverId)}`
  );
 
  ws._room = room;
 
  ws.onopen = () => console.log(`Chat WS connected | room: ${room}`);
 
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (["task_status", "new_task", "init", "ping"].includes(data.type)) return;
      if (messageHandler) messageHandler(data);
    } catch {
      if (messageHandler) messageHandler({
        sender_id: null,
        message:   event.data,
        timestamp: Date.now() / 1000,
      });
    }
  };
 
  ws.onerror = (err) => console.error("Chat WS error:", err);
  ws.onclose = ()    => console.log("Chat WS closed");
};
 
export const sendMessageWS = (senderId, receiverId, message) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error("WebSocket is not connected");
    return;
  }
  ws.send(JSON.stringify({
    sender_id:   senderId,
    receiver_id: receiverId,
    message:     message,
  }));
};
 
export const fetchMessages = async (user1, user2) => {
  try {
    const res = await fetch(
      `http://localhost:8000/api/chat/history/${encodeURIComponent(user1)}/${encodeURIComponent(user2)}`
    );
    if (!res.ok) throw new Error("Failed to fetch messages");
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
};
 
export const fetchConversations = async (userId) => {
  try {
    const res = await fetch(
      `http://localhost:8000/api/chat/inbox/${encodeURIComponent(userId)}`
    );
    if (!res.ok) throw new Error("Failed to fetch conversations");
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
};
 
export const fetchSharedTasks = async (customerId, workerId) => {
  try {
    const res = await fetch(
      `http://localhost:8000/api/tasks/between/${encodeURIComponent(workerId)}/${encodeURIComponent(customerId)}`
    );
    if (!res.ok) throw new Error("Failed to fetch shared tasks");
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
};
 
export const closeWebSocket = () => {
  if (ws) { ws.close(); ws = null; }
};
 

export const getWorkerByCategory = async (category) => {
  const url = `http://localhost:8000/api/worker/category/${category}`;

  const res = await fetch(url);

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Failed to fetch workers");
  }

  return await res.json();
};

export const getReviewsById = async (workerId) => {
  try {
    const res = await fetch(`http://localhost:8000/api/reviews/worker/${workerId}`);
    if (!res.ok) throw new Error("Failed to fetch reviews");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const getSearchRecommendations = async (searchText, limit = 5) => {
  try {
    const res = await fetch(`http://localhost:8000/api/search/?q=${encodeURIComponent(searchText)}&limit=${limit}`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return data;  // this will be an array of matched tasks
  } catch (err) {
    console.error("Error fetching search recommendations:", err);
    return [];  // return empty array on error
  }
};

// api/api.js
export const classifyImage = async (file) => {
  try {
    console.log('File details:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    const formData = new FormData();
    formData.append('file', file);
    
    console.log('Sending to:', `http://127.0.0.1:8000/api/api/image/predict`);
    
    const response = await fetch(`http://127.0.0.1:8000/api/api/image/predict`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type - browser sets it automatically with boundary
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Classification result:', data);
    return data;
  } catch (error) {
    console.error('Image classification API error:', error);
    throw error;
  }
};



export const updateTaskStatus = async (taskId, status) => {
  try {
    const response = await fetch(
      `http://127.0.0.1:8000/api/task/${taskId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.log("Error while changing task status", error);
  }
};

export const getTasksByWorker= async (workerId) =>{
  try{
    const response=await fetch(`http://127.0.0.1:8000/api/tasks/worker/${workerId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      }
    }
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.log("Error while changing task status", error);
  }
};

export const getTaskById = async (taskId) => {
  try{
    const res = await fetch (`http://127.0.0.1:8000/api/task/${taskId}`,
      {
        method: 'GET',
        headers:{
          "Content-Type": "application/json",
        }
      }
    );
    const data=await res.json()
    return data
  }
  catch (error) {
    console.log("Error while changing task status", error);
    }
}

export const predictTask = async (text) => {
  const res = await fetch("http://localhost:8000/api/predict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });
 
  if (!res.ok) {
    throw new Error("Prediction failed");
  }
 
  return res.json();
};

// api/api.js
export const loginUsingGoogle = async (googleData) => {
  try {
    const payload = {
      email: googleData.email,
      name: googleData.name,
      google_id: googleData.sub,  // Google's unique user ID
      picture: googleData.picture || ""  // ✅ Provide default empty string
    };

    console.log("📤 Sending to backend:", payload);  // ✅ DEBUG LOG

    const response = await fetch(`http://127.0.0.1:8000/api/google-login`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload)
    });

    console.log("📥 Response status:", response.status);  // ✅ DEBUG LOG

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Error response:", errorData);  // ✅ DEBUG LOG
      throw new Error(errorData.detail || 'Google login failed');
    }

    const data = await response.json();
    console.log("✅ Success response:", data);  // ✅ DEBUG LOG
    return data;
  } catch (error) {
    console.error("Error during Google login:", error);
    throw error;
  }
};

let taskWs = null;
export const connectTaskWebSocket = (userId, onMessage) => {
  if (taskWs) taskWs.close();
  if (taskWs && taskWs.readyState === WebSocket.OPEN) taskWs.close();

  taskWs = new WebSocket(`ws://127.0.0.1:8000/ws/task-updates/${userId}`);

  taskWs.onopen = () => console.log("✅ Task WS connected");

  taskWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) onMessage(data);
    } catch (err) {
      console.error("Task WS parse error:", err);
    }
  };

  taskWs.onerror = (err) => console.error("❌ Task WS error:", err);
  taskWs.onclose = () => console.log("🔌 Task WS closed");

  return taskWs;
};

export const closeTaskWebSocket = () => {
  if (taskWs) { taskWs.close(); taskWs = null; }
};

// api.js
// api/api.js or wherever your API functions are
export const recommendWorker = async ({ taskType, lat, lng, subCategory, top_k = 5 }) => {
  try {
    const payload = {
      taskType,
      lat,
      lng,
      subCategory,
      top_k
    };

    console.log("📤 Sending recommendation request:", payload);

    const res = await fetch("http://localhost:8000/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || `HTTP ${res.status} Error`);
    }

    const data = await res.json();
    console.log("Recommended workers:", data.recommended_workers);
    return data.recommended_workers;
  } catch (err) {
    console.error("Error fetching recommended workers:", err);
    return [];
  }
};

export const workerStats = async (workerId) => {
  try {
    const res = await fetch(`http://localhost:8000/api/stats/${workerId}`, {
      method: "GET", // or POST if your backend expects POST
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} Error`);
    return await res.json();
  } catch (err) {
    console.error("Error fetching worker stats:", err);
    return null;
  }
};

export const getPaymentStatus = async (taskId) =>{
  try{
    const res= await fetch(`http://localhost:8000/api/payment/status/${taskId}`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json()

  }

  catch (err) {
    console.error("Error fetching worker stats:", err);
    return null;
  }
}

export const getEscrowStatus = async (taskId) =>{
  try{
    const res=await fetch(`http://localhost:8000/api/payment/escrow/status/${taskId}`,{
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json()
  }
  catch (err) {
    console.error("Error fetching worker stats:", err);
    return null;
  }
}



// GET /api/stats/{workerId}
// Returns: totalEarnings, earningsGraph, tasksCompleted, tasksToday, tasksTomorrow, averageRating, etc.


// GET /worker/earning/{workerId}
// Returns: todayEarnings, weekEarnings, monthEarnings, totalEarnings, completedTasks
export const workerEarnings = (workerId) =>
  fetch(`http://localhost:8000/worker/earning/${encodeURIComponent(workerId)}`)
    .then(r => r.json());


//adminnnnnnn

export const getAdminStats = async () =>{
  try{
    const res= await fetch(`http://localhost:8000/api/admin/stats`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json()
  }
  catch (err) {
    console.error("Error fetching worker stats:", err);
    return null;
  }
}

export const getUserGrowth = async (period) =>{
  try{
    const res= await fetch(`http://localhost:8000/api/admin/growth/${period}`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json()
  }
  catch (err) {
    console.error("Error fetching worker stats:", err);
    return null;
  }
}

export const getAdminAlerts = async () =>{
  try{
    const res= await fetch(`http://localhost:8000/api/admin/alert`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json()
  }
  catch (err) {
    console.error("Error fetching worker stats:", err);
    return null;
  }
}

export const getRecentActivities = async () =>{
  try{
    const res= await fetch(`http://localhost:8000/api/admin/activity`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json()
  }
  catch (err) {
    console.error("Error fetching worker stats:", err);
    return null;
  }
}

export const getTopLocations = async () =>{
  try{
    const res= await fetch(`http://localhost:8000/api/admin/revenue/location`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json()
  }
  catch (err) {
    console.error("Error fetching worker stats:", err);
    return null;
  }
}

export const getTaskIdFromWorkerAndCustomer = async (workerId, customerId) => {
  try {
    const url = `http://localhost:8000/api/tasks/${encodeURIComponent(workerId)}/${encodeURIComponent(customerId)}`;
    console.log("🔍 Fetching:", url);
    const res = await fetch(url);
    const data = await res.json();
    console.log("📦 Response:", data);
    return data.tasks || null;
  } catch (err) {
    console.error("Error fetching task ID:", err);
    return null;
  }
}

export const updateOfferDetails = async (taskId, offerData) => {
  try {
    const response = await fetch(
      `http://localhost:8000/api/tasks/${taskId}/offer`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offerData)
      }
    );

    const data = await response.json();
    
    // 👇 Add this
    if (!response.ok) {
      console.error("❌ Server validation error:", JSON.stringify(data, null, 2));
    }
    
    return data;
  } catch (error) {
    console.log("Error while changing offer status", error);
  }
};

export const pendingActivities = async () =>{
  try{
    const res= await fetch(`http://localhost:8000/api/admin/pending`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json()
  }
  catch (err) {
    console.error("Error fetching worker stats:", err);
    return null;
  }
}

export const getNoOfTasksAssignedByEachCustomer = async () => {
  try {
    const res = await fetch(`http://localhost:8000/api/tasks/count`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.error("Error fetching task counts:", err);
    return null;
  }
}

export const getAIReview = async (reportId) => {
  try {
    const res=await fetch(`http://localhost:8000/api/reports/${reportId}/ai-review`,{
      method: 'POST',
      headers: { "Content-Type": "application/json" },
    })
    return await res.json();
  } catch (err) {
    console.error("Error fetching AI review:", err);
    return null;
  }
}




// GET /home/popular-services/{category}
export const getPopularServices = async () => {
  const res = await fetch(`${BASE_URL}/popular-services`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// GET /home/top-rated/
export const getTopRated = async (limit = 8) => {
  const res = await fetch(`${BASE_URL}/top-rated/?limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// GET /home/emergency/
export const getEmergencyWorkers = async (limit = 8) => {
  const res = await fetch(`${BASE_URL}/emergency/?limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const getPriceByTask = async (category, worker_id) => {
  try {
    const res = await fetch(`${BASE_URL}/basePrice/${category}/${worker_id}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};

// ── Availability API ──────────────────────────────────────────────────────────
// Append these to your existing api.js file
// ── Availability API ──────────────────────────────────────────────────────────
// Append these to your existing api.js (remove the BASE_URL line below,
// it's already defined at the top of your api.js)

// GET /worker/{worker_id}/availability
export const getAvailability = async (worker_id) => {
  try {
    const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};

// PUT /worker/{worker_id}/availability/hours — replace full weekly schedule
// hours = { Monday: [{start, end}], Tuesday: [], ... }
export const updateWeeklyHours = async (worker_id, hours) => {
  const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability/hours`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hours),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// PATCH /worker/{worker_id}/availability/hours/day — update one day
// slots = [{start: "09:00", end: "17:00"}] or [] to clear
export const updateDayHours = async (worker_id, day, slots) => {
  const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability/hours/day`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day, slots }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// POST /worker/{worker_id}/availability/unavailable-dates
export const addUnavailableDates = async (worker_id, dates) => {
  const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability/unavailable-dates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dates }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// DELETE /worker/{worker_id}/availability/unavailable-dates
export const removeUnavailableDates = async (worker_id, dates) => {
  const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability/unavailable-dates`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dates }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// PATCH /worker/{worker_id}/availability/toggle — global on/off
export const toggleAvailability = async (worker_id, isAvailable) => {
  const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability/toggle`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isAvailable }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// GET /worker/{worker_id}/availability/check?date=YYYY-MM-DD
export const checkAvailabilityOnDate = async (worker_id, date) => {
  try {
    const res = await fetch(
      `${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability/check?date=${date}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};

// components/HelpSection/helpApi.js


export async function sendChatMessage(message) {
  const res = await fetch(BASE_URL + "/chatbot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  return data.response || "Sorry, I couldn't get a response. Please try again.";
}


// api/customerProfile.js

// ── UPDATE INDIVIDUAL FIELDS ──────────────────────────────────────────────────
export const updateName = (id, firstName, lastName) =>
  fetch(`http://127.0.0.1:8000/api/update/customer/update-name`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: id, first_name: firstName, last_name: lastName }),
  });

export const updateAddress = (id, address) =>
  fetch(`http://127.0.0.1:8000/api/update/customer/update-address`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: id, address }),
  });

export const updateDob = (id, date_of_birth) =>
  fetch(`http://127.0.0.1:8000/api/update/customer/update-dob`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: id, date_of_birth }),
  });

export const updateGender = (id, gender) =>
  fetch(`http://127.0.0.1:8000/api/update/customer/update-gender`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: id, gender }),
  });

export const updateBio = (id, bio) =>
  fetch(`http://127.0.0.1:8000/api/update/customer/update-bio`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: id, bio }),
  });

export const updatePhoto = (id, file) => {
  const fd = new FormData();
  fd.append("file", file);
    return fetch(`http://127.0.0.1:8000/api/update/customer/${id}/photo`, {
    method: "PATCH",
    body: fd,
    });
  };



export const getReviewsByCustomer = async (customerId) =>{
  try{
    const res=await fetch(`http://localhost:8000/api/reviews/customer/${customerId}`,{
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json()
  }
  catch (err) {
    console.error("Error fetching worker stats:", err);
    return null;
  }
}

// ── Auth helpers (if not already at top) ─────────────────────────────────────
const authH = () => {
  const t = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};
const authHM = () => {
  const t = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// ── Customer Profile ──────────────────────────────────────────────────────────
export const getCustomer = (id) =>
  fetch(`http://localhost:8000/api/customer/${id}`, { headers: authH() });

export const getCustomerTasks = (id) =>
  fetch(`http://localhost:8000/api/tasks/user/${id}`, { headers: authH() });

export const getCustomerReports = (id) =>
  fetch(`http://localhost:8000/api/reports/user/${id}`, { headers: authH() });

export const getCustomerReviews = (id) =>
  fetch(`http://localhost:8000/api/reviews/customer/${id}`, { headers: authH() });

export const releaseEscrow = (taskId) =>
  fetch(`http://localhost:8000/api/payment/escrow/release/${taskId}`, {
    method: "PATCH",
    headers: authH(),
  });

export const postReport = (reportData) =>
  fetch(`http://localhost:8000/api/reports`, {
    method: "POST",
    headers: authH(),
    body: JSON.stringify(reportData),
  });

  export const autoCancelExpiredTasks = async () => {
  try {
    const response = await fetch(`http://localhost:8000/api/tasks/auto-cancel-expired`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error("Auto-cancel failed");
    return await response.json();
  } catch (err) {
    console.error("Auto-cancel expired tasks failed:", err);
  }
};

export const autoCancelConfirmedUnpaidTasks = async () => {
  try {
    const response = await fetch(`http://localhost:8000/api/tasks/auto-cancel-confirmed-unpaid`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error("Auto-cancel confirmed unpaid failed");
    return await response.json();
  } catch (err) {
    console.error("Auto-cancel confirmed unpaid tasks failed:", err);
  }
};