export const categories = [
  { id: 1, name: 'Carpentry', icon: 'Hammer' },
  { id: 2, name: 'Appliance Repair', icon: 'Drill' },
  { id: 3, name: 'Plumbing', icon: 'Wrench' },
  { id: 4, name: 'Moving', icon: 'Truck' },
  { id: 5, name: 'Cleaning', icon: 'Sparkles' },
  { id: 6, name: 'Outdoor Help', icon: 'Trees' },
  { id: 7, name: 'Painting', icon: 'Paintbrush' },
  { id: 8, name: 'Electrical', icon: 'Zap' },
  { id: 9, name: 'Furniture Repair', icon: 'Armchair' },
  { id: 10, name: 'Lawn Care', icon: 'Leaf' },
];

export const workers = [
  {
    id: 1,
    name: 'Michael Rodriguez',
    service: 'Furniture Repair',
    rating: 4.9,
    reviews: 127,
    completedJobs: 245,
    hourlyRate: 45,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    verified: true,
    skills: ['Wood Repair', 'Refinishing', 'Assembly'],
    responseTime: '2 hours'
  },
  {
    id: 2,
    name: 'Sarah Chen',
    service: 'Lawn Care',
    rating: 5.0,
    reviews: 203,
    completedJobs: 412,
    hourlyRate: 35,
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    verified: true,
    skills: ['Mowing', 'Landscaping', 'Fertilization'],
    responseTime: '1 hour'
  },
  {
    id: 3,
    name: 'James Patterson',
    service: 'Plumbing',
    rating: 4.8,
    reviews: 189,
    completedJobs: 356,
    hourlyRate: 65,
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    verified: true,
    skills: ['Leak Repair', 'Installation', 'Emergency'],
    responseTime: '30 minutes'
  },
  {
    id: 4,
    name: 'Emily Thompson',
    service: 'House Cleaning',
    rating: 4.9,
    reviews: 312,
    completedJobs: 589,
    hourlyRate: 40,
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    verified: true,
    skills: ['Deep Cleaning', 'Organizing', 'Move-out'],
    responseTime: '3 hours'
  },
  {
    id: 5,
    name: 'David Kim',
    service: 'Electrical Work',
    rating: 4.7,
    reviews: 156,
    completedJobs: 298,
    hourlyRate: 70,
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
    verified: true,
    skills: ['Wiring', 'Panel Upgrade', 'Lighting'],
    responseTime: '1 hour'
  },
  {
    id: 6,
    name: 'Lisa Martinez',
    service: 'Painting',
    rating: 5.0,
    reviews: 178,
    completedJobs: 267,
    hourlyRate: 50,
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop',
    verified: true,
    skills: ['Interior', 'Exterior', 'Cabinet'],
    responseTime: '2 hours'
  },
];

export const reviews = [
  {
    id: 1,
    name: 'Jennifer Wilson',
    service: 'Electrical Help',
    rating: 5,
    date: 'March 15, 2026',
    comment: 'The electrician arrived exactly on time and knew exactly what to do. 100% would hire again!',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop'
  },
  {
    id: 2,
    name: 'Mark Stevens',
    service: 'Plumbing',
    rating: 5,
    date: 'March 10, 2026',
    comment: 'Had an emergency leak. He was prompt, communicative, and efficient. Highly recommend!',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'
  },
  {
    id: 3,
    name: 'Rebecca Moore',
    service: 'General Mounting',
    rating: 5,
    date: 'March 5, 2026',
    comment: 'Patient and willing to help figure it out with us. Thank you!',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop'
  },
];

export const howItWorksSteps = [
  {
    step: 1,
    title: 'Send a Request',
    description: 'Describe your project and what you need help with.',
    color: '#E0E7FF'
  },
  {
    step: 2,
    title: 'Negotiate Pricing',
    description: 'Chat with workers and agree on fair pricing.',
    color: '#FEF3C7'
  },
  {
    step: 3,
    title: 'Worker Accepts',
    description: 'Worker accepts the job and commits to your timeline.',
    color: '#D1FAE5'
  },
  {
    step: 4,
    title: 'Pay in Escrow',
    description: 'Your payment is held securely in escrow.',
    color: '#DBEAFE'
  },
  {
    step: 5,
    title: 'Work Completed',
    description: 'Worker completes the job to your satisfaction.',
    color: '#FCE7F3'
  },
  {
    step: 6,
    title: 'Escrow Released',
    description: 'Payment is released to the worker.',
    color: '#D5F5E3'
  }
];