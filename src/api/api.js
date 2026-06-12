const BASE_URL = "http://localhost:8000/api";
const WS_URL   = "ws://localhost:8000";

// ── Helper ────────────────────────────────────────────────────────────────────
const apiCall = async (endpoint, options = {}) => {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Something went wrong');
  return data;
};

const authH = () => {
  const t = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};
const authHM = () => {
  const t = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// ── Auth / OTP ────────────────────────────────────────────────────────────────
export const checkEmailExists = async (email) => {
  try {
    const data = await apiCall(`/api/checkEmailExists?email=${encodeURIComponent(email)}`);
    return data.exists;
  } catch (error) {
    console.error('Error checking email:', error);
    throw error;
  }
};

export const checkPhoneExists = async (phone) => {
  try {
    const data = await apiCall(`/api/checkCusPhone?phoneNo=${encodeURIComponent(phone)}`);
    return data.exists;
  } catch (error) {
    console.error('Error checking phone:', error);
    throw error;
  }
};

export const sendVerificationCode = async (email) => {
  try {
    return await apiCall('/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  } catch (error) {
    console.error('Error sending verification code:', error);
    throw error;
  }
};

export const verifyEmailCode = async (email, code) => {
  try {
    const response = await fetch(`${BASE_URL}/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp: code }),
    });
    await response.json();
    return true;
  } catch (error) {
    console.error('Error verifying code:', error);
    throw error;
  }
};

export const sendOtp = async (email) => {
  const res = await fetch(`${BASE_URL}/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to send OTP');
  return data;
};

export const verifyOtp = async (email, otp) => {
  const res = await fetch(`${BASE_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Invalid code. Please try again.');
  return data;
};

export const loginUser = async (data) => {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Login failed');
  const result = await res.json();
  return result.access_token;
};

export const loginUsingGoogle = async (googleData) => {
  try {
    const payload = {
      email:     googleData.email,
      name:      googleData.name,
      google_id: googleData.sub,
      picture:   googleData.picture || "",
    };
    const response = await fetch(`${BASE_URL}/google-login`, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Google login failed');
    }
    return await response.json();
  } catch (error) {
    console.error("Error during Google login:", error);
    throw error;
  }
};

// ── Customer ──────────────────────────────────────────────────────────────────
export const registerCustomer = async (customerData) => {
  try {
    return await apiCall('/customer', {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  } catch (error) {
    console.error('Error registering customer:', error);
    throw error;
  }
};

export const fetchCustomerById = async (customerId) => {
  try {
    const res = await fetch(`${BASE_URL}/customer/${customerId}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Error fetching customer:", err);
    return [];
  }
};

export const fetchAllCustomer = async () => {
  try {
    const res = await fetch(`${BASE_URL}/customer/all`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.log("failed to load customers");
  }
};

export const getCustomer = (id) =>
  fetch(`${BASE_URL}/customer/${id}`, { headers: authH() });

export const getCustomerTasks = (id) =>
  fetch(`${BASE_URL}/tasks/user/${id}`, { headers: authH() });

export const getCustomerReports = (id) =>
  fetch(`${BASE_URL}/reports/user/${id}`, { headers: authH() });

export const getCustomerReviews = (id) =>
  fetch(`${BASE_URL}/reviews/customer/${id}`, { headers: authH() });

export const updateName = (id, firstName, lastName) =>
  fetch(`${BASE_URL}/update/customer/update-name`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: id, first_name: firstName, last_name: lastName }),
  });

export const updateAddress = (id, address) =>
  fetch(`${BASE_URL}/update/customer/update-address`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: id, address }),
  });

export const updateDob = (id, date_of_birth) =>
  fetch(`${BASE_URL}/update/customer/update-dob`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: id, date_of_birth }),
  });

export const updateGender = (id, gender) =>
  fetch(`${BASE_URL}/update/customer/update-gender`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: id, gender }),
  });

export const updateBio = (id, bio) =>
  fetch(`${BASE_URL}/update/customer/update-bio`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: id, bio }),
  });

export const updatePhoto = (id, file) => {
  const fd = new FormData();
  fd.append("file", file);
  return fetch(`${BASE_URL}/update/customer/${id}/photo`, {
    method: "PATCH",
    body: fd,
  });
};

export const getReviewsByCustomer = async (customerId) => {
  try {
    const res = await fetch(`${BASE_URL}/reviews/customer/${customerId}`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.error("Error fetching reviews:", err);
    return null;
  }
};

// ── Worker ────────────────────────────────────────────────────────────────────
export const registerWorker = async (payload) => {
  const res = await fetch(`${BASE_URL}/worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.message || 'Something went wrong');
  return data;
};

export const fetchAllWorkers = async () => {
  try {
    const res = await fetch(`${BASE_URL}/workers/all`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.log("failed to load workers");
  }
};

export const fetchWorkerById = async (workerId) => {
  try {
    const res = await fetch(`${BASE_URL}/worker/${workerId}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Error fetching worker:", err);
    return [];
  }
};

export const getWorkerByCategory = async (category) => {
  const res = await fetch(`${BASE_URL}/worker/category/${category}`);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Failed to fetch workers");
  }
  return res.json();
};

export const getWorkerBySubcategory = async (category, subcategory) => {
  try {
    const res = await fetch(
      `${BASE_URL}/worker/category/${encodeURIComponent(category)}/subcategory/${encodeURIComponent(subcategory)}`
    );
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Error fetching workers by subcategory:", err);
    return [];
  }
};

export const updateWorkerProfile = async (workerId, payload) => {
  const res = await fetch(`${BASE_URL}/worker/${workerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const uploadSkillEvidence = async (email, skill, file) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('worker_id', email);
  fd.append('skill', skill);
  const res = await fetch(`${BASE_URL}/upload/skill-evidence`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) throw new Error(`Evidence upload failed for ${skill}`);
  return res.json();
};

export const workerStats = async (workerId) => {
  try {
    const res = await fetch(`${BASE_URL}/stats/${workerId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} Error`);
    return await res.json();
  } catch (err) {
    console.error("Error fetching worker stats:", err);
    return null;
  }
};

export const workerEarnings = (workerId) =>
  fetch(`${BASE_URL.replace('/api', '')}/worker/earning/${encodeURIComponent(workerId)}`)
    .then(r => r.json());

export const getRecentPayouts = async (workerId) => {
  const res = await fetch(`${BASE_URL}/worker/${workerId}/recent-payouts`);
  return res.json();
};

// ── Availability ──────────────────────────────────────────────────────────────
export const fetchWorkerAvailability = async (workerId) => {
  const res = await fetch(`${BASE_URL.replace('/api', '')}/worker/availability/${encodeURIComponent(workerId)}`);
  if (!res.ok) throw new Error("Failed to fetch availability");
  return res.json();
};

export const getAvailability = async (worker_id) => {
  try {
    const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};

export const updateWeeklyHours = async (worker_id, hours) => {
  const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability/hours`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hours),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const updateDayHours = async (worker_id, day, slots) => {
  const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability/hours/day`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day, slots }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const addUnavailableDates = async (worker_id, dates) => {
  const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability/unavailable-dates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dates }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const removeUnavailableDates = async (worker_id, dates) => {
  const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability/unavailable-dates`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dates }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const toggleAvailability = async (worker_id, isAvailable) => {
  const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability/toggle`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isAvailable }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const checkAvailabilityOnDate = async (worker_id, date) => {
  try {
    const res = await fetch(`${BASE_URL}/worker/${encodeURIComponent(worker_id)}/availability/check?date=${date}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};

export const fetchFreeSlotRange = async (workerId, startDate, endDate) => {
  const res = await fetch(
    `${BASE_URL}/worker/free-slots-range/${encodeURIComponent(workerId)}?start_date=${startDate}&end_date=${endDate}`
  );
  if (!res.ok) throw new Error("Failed to fetch free slots");
  const data = await res.json();
  return data.freeSlots || {};
};

export const saveDateOverride = async (workerId, dateStr, slots) => {
  const body = {
    workerId,
    date: dateStr,
    availableStatus: slots.length > 0 ? "free" : "unavailable",
    available: slots.length > 0,
    slots: slots.map(({ start, end }) => ({ start, end })),
  };
  const res = await fetch(`${BASE_URL}/availability/update-day`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save date override");
  return res.json();
};

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const createTask = async (formData) => {
  try {
    const response = await fetch(`${BASE_URL}/task`, {
      method: "POST",
      body: formData,
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

export const getTasksByWorker = async (workerId) => {
  try {
    const response = await fetch(`${BASE_URL}/tasks/worker/${workerId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return await response.json();
  } catch (error) {
    console.log("Error fetching worker tasks", error);
  }
};

export const getTaskById = async (taskId) => {
  try {
    const res = await fetch(`${BASE_URL}/task/${taskId}`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (error) {
    console.log("Error fetching task:", error);
  }
};

export const updateTaskStatus = async (taskId, status, reason = null) => {
  if (status === "declined" && reason) {
    const res = await fetch(`${BASE_URL}/task/${taskId}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
  const res = await fetch(`${BASE_URL}/task/${taskId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const cancelWorkerTask = async (taskId, cancelledBy, reason) => {
  const response = await fetch(`${BASE_URL}/task/${taskId}/cancel`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cancelled_by: cancelledBy, reason }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Cancel failed");
  }
  return response.json();
};

export const getTaskIdFromWorkerAndCustomer = async (workerId, customerId) => {
  try {
    const res = await fetch(
      `${BASE_URL}/tasks/${encodeURIComponent(workerId)}/${encodeURIComponent(customerId)}`
    );
    const data = await res.json();
    return data.tasks || null;
  } catch (err) {
    console.error("Error fetching task ID:", err);
    return null;
  }
};

export const updateOfferDetails = async (taskId, offerData) => {
  try {
    const response = await fetch(`${BASE_URL}/tasks/${taskId}/offer`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(offerData),
    });
    const data = await response.json();
    if (!response.ok) console.error("Server validation error:", JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.log("Error while changing offer status", error);
  }
};

export const requestExtraPayment = async (taskId, workerId, amount, reason) => {
  const res = await fetch(`${BASE_URL}/tasks/${taskId}/request-extra`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worker_id: workerId, amount: Number(amount), reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to send request");
  }
  return res.json();
};

export const autoCancelExpiredTasks = async () => {
  try {
    const response = await fetch(`${BASE_URL}/tasks/auto-cancel-expired`, {
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
    const response = await fetch(`${BASE_URL}/tasks/auto-cancel-confirmed-unpaid`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error("Auto-cancel confirmed unpaid failed");
    return await response.json();
  } catch (err) {
    console.error("Auto-cancel confirmed unpaid tasks failed:", err);
  }
};

export const getNoOfTasksAssignedByEachCustomer = async () => {
  try {
    const res = await fetch(`${BASE_URL}/tasks/count`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.error("Error fetching task counts:", err);
    return null;
  }
};

// ── Payment ───────────────────────────────────────────────────────────────────
export const getPaymentStatus = async (taskId) => {
  try {
    const res = await fetch(`${BASE_URL}/payment/status/${taskId}`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.error("Error fetching payment status:", err);
    return null;
  }
};

export const getEscrowStatus = async (taskId) => {
  try {
    const res = await fetch(`${BASE_URL}/payment/escrow/status/${taskId}`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.error("Error fetching escrow status:", err);
    return null;
  }
};

export const releaseEscrow = (taskId) =>
  fetch(`${BASE_URL}/payment/escrow/release/${taskId}`, {
    method: "PATCH",
    headers: authH(),
  });

// ── Reviews ───────────────────────────────────────────────────────────────────
export const getReviewsById = async (workerId) => {
  try {
    const res = await fetch(`${BASE_URL}/reviews/worker/${workerId}`);
    if (!res.ok) throw new Error("Failed to fetch reviews");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(err);
    return [];
  }
};

// ── Recommendations ───────────────────────────────────────────────────────────
export const recommendWorker = async ({ taskType, lat, lng, subCategory, top_k = 5 }) => {
  try {
    const res = await fetch(`${BASE_URL.replace('/api', '')}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskType, lat, lng, subCategory, top_k }),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || `HTTP ${res.status} Error`);
    }
    const data = await res.json();
    return data.recommended_workers;
  } catch (err) {
    console.error("Error fetching recommended workers:", err);
    return [];
  }
};

export const getSearchRecommendations = async (searchText, limit = 5) => {
  try {
    const res = await fetch(`${BASE_URL}/search/?q=${encodeURIComponent(searchText)}&limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Error fetching search recommendations:", err);
    return [];
  }
};

export const predictTask = async (text) => {
  const res = await fetch(`${BASE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Prediction failed");
  return res.json();
};

// ── Image ─────────────────────────────────────────────────────────────────────
export const classifyImage = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${BASE_URL}/api/image/predict`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Image classification API error:', error);
    throw error;
  }
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const postReport = (reportData) =>
  fetch(`${BASE_URL}/reports`, {
    method: "POST",
    headers: authH(),
    body: JSON.stringify(reportData),
  });

export const getReportsByUser = async (userId) => {
  const res = await fetch(`${BASE_URL}/reports/user/${userId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const getAIReview = async (reportId) => {
  try {
    const res = await fetch(`${BASE_URL}/reports/${reportId}/ai-review`, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.error("Error fetching AI review:", err);
    return null;
  }
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const getAdminStats = async () => {
  try {
    const res = await fetch(`${BASE_URL}/admin/stats`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    return null;
  }
};

export const getUserGrowth = async (period) => {
  try {
    const res = await fetch(`${BASE_URL}/admin/growth/${period}`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.error("Error fetching user growth:", err);
    return null;
  }
};

export const getAdminAlerts = async () => {
  try {
    const res = await fetch(`${BASE_URL}/admin/alert`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.error("Error fetching admin alerts:", err);
    return null;
  }
};

export const getRecentActivities = async () => {
  try {
    const res = await fetch(`${BASE_URL}/admin/activity`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.error("Error fetching recent activities:", err);
    return null;
  }
};

export const getTopLocations = async () => {
  try {
    const res = await fetch(`${BASE_URL}/admin/revenue/location`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.error("Error fetching top locations:", err);
    return null;
  }
};

export const pendingActivities = async () => {
  try {
    const res = await fetch(`${BASE_URL}/admin/pending`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  } catch (err) {
    console.error("Error fetching pending activities:", err);
    return null;
  }
};

// ── Home / Discovery ──────────────────────────────────────────────────────────
export const getPopularServices = async () => {
  const res = await fetch(`${BASE_URL}/popular-services`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const getTopRated = async (limit = 8) => {
  const res = await fetch(`${BASE_URL}/top-rated/?limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

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

// ── Chatbot ───────────────────────────────────────────────────────────────────
export const sendChatMessage = async (message, endpoint) => {
  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL.replace('/api', '')}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  return data.response;
};

// ── WebSocket ─────────────────────────────────────────────────────────────────
let ws = null;
let messageHandler = null;

export const connectWebSocket = (senderId, receiverId, onMessage) => {
  messageHandler = onMessage;
  const room = [senderId, receiverId].sort().join("__");
  if (ws && ws.readyState === WebSocket.OPEN && ws._room === room) return;
  if (ws) { ws.close(); ws = null; }
  ws = new WebSocket(
    `${WS_URL}/api/ws/${encodeURIComponent(senderId)}/${encodeURIComponent(receiverId)}`
  );
  ws._room = room;
  ws.onopen    = () => console.log(`Chat WS connected | room: ${room}`);
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (["task_status", "new_task", "init", "ping"].includes(data.type)) return;
      if (messageHandler) messageHandler(data);
    } catch {
      if (messageHandler) messageHandler({ sender_id: null, message: event.data, timestamp: Date.now() / 1000 });
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
  ws.send(JSON.stringify({ sender_id: senderId, receiver_id: receiverId, message }));
};

export const fetchMessages = async (user1, user2) => {
  try {
    const res = await fetch(
      `${BASE_URL}/chat/history/${encodeURIComponent(user1)}/${encodeURIComponent(user2)}`
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
    const res = await fetch(`${BASE_URL}/chat/inbox/${encodeURIComponent(userId)}`);
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
      `${BASE_URL}/tasks/between/${encodeURIComponent(workerId)}/${encodeURIComponent(customerId)}`
    );
    if (!res.ok) throw new Error("Failed to fetch shared tasks");
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const recordWorkerView = (workerId, viewerId = null) =>
  fetch(`${BASE_URL}/worker/${workerId}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewer_id: viewerId }),
  });

export const getWorkerViewCount = (workerId) =>
  fetch(`${BASE_URL}/worker/${workerId}/views`).then(res => res.json());

export const closeWebSocket = () => {
  if (ws) { ws.close(); ws = null; }
};

let taskWs = null;

export const connectTaskWebSocket = (userId, onMessage) => {
  if (taskWs && taskWs.readyState === WebSocket.OPEN) taskWs.close();
  taskWs = new WebSocket(`${WS_URL}/ws/task-updates/${userId}`);
  taskWs.onopen    = () => console.log("Task WS connected");
  taskWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) onMessage(data);
    } catch (err) {
      console.error("Task WS parse error:", err);
    }
  };
  taskWs.onerror = (err) => console.error("Task WS error:", err);
  taskWs.onclose = ()    => console.log("Task WS closed");
  return taskWs;
};

export const closeTaskWebSocket = () => {
  if (taskWs) { taskWs.close(); taskWs = null; }
};

