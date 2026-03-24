// taskUtils.js

// Status configuration
export const TASK_STATUS = {
    pending: {
      label: "Pending",
      color: "bg-yellow-100 text-yellow-800 border-yellow-300",
      icon: "Clock",
      dotColor: "bg-yellow-500",
      bgColor: "bg-yellow-50",
      textColor: "text-yellow-600",
      borderColor: "border-yellow-500"
    },
    in_progress: {
      label: "In Progress",
      color: "bg-blue-100 text-blue-800 border-blue-300",
      icon: "AlertCircle",
      dotColor: "bg-blue-500",
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
      borderColor: "border-blue-500"
    },
    completed: {
      label: "Completed",
      color: "bg-green-100 text-green-800 border-green-300",
      icon: "CheckCircle",
      dotColor: "bg-green-500",
      bgColor: "bg-green-50",
      textColor: "text-green-600",
      borderColor: "border-green-500"
    },
    cancelled: {
      label: "Cancelled",
      color: "bg-red-100 text-red-800 border-red-300",
      icon: "XCircle",
      dotColor: "bg-red-500",
      bgColor: "bg-red-50",
      textColor: "text-red-600",
      borderColor: "border-red-500"
    }
  };
  
  // Get status info
  export const getStatusInfo = (status) => {
    return TASK_STATUS[status] || TASK_STATUS.pending;
  };
  
  // Format time
  export const formatTime = (timeArray) => {
    if (!timeArray || !Array.isArray(timeArray)) return "Not set";
    return timeArray.join(", ");
  };
  
  // Filter tasks
  export const filterTasks = (tasks, filterStatus, searchQuery) => {
    return tasks.filter(task => {
      const matchesFilter = filterStatus === "all" || task.status === filterStatus;
      const matchesSearch = searchQuery === "" || 
        task.taskName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.taskDescrip?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.taskType?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  };
  
  // Calculate status counts
  export const getStatusCounts = (tasks) => {
    return {
      all: tasks.length,
      pending: tasks.filter(t => t.status === "pending").length,
      in_progress: tasks.filter(t => t.status === "in_progress").length,
      completed: tasks.filter(t => t.status === "completed").length,
      cancelled: tasks.filter(t => t.status === "cancelled").length,
    };
  };
  
  // Sort tasks by priority or date
  export const sortTasks = (tasks, sortBy = 'status') => {
    const sorted = [...tasks];
    
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.taskName?.localeCompare(b.taskName));
      case 'status':
        const statusOrder = { pending: 1, in_progress: 2, completed: 3, cancelled: 4 };
        return sorted.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
      default:
        return sorted;
    }
  };