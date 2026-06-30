export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface AIAnalysis {
  confidence: number;
  riskAssessment: string;
  priorityScore: number;
  citizenSafetyAdvice: string;
  suggestedResolution: string;
  estimatedResolutionDays: number;
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  department: string;
  status: "Reported" | "Analyzed" | "Verified" | "In Progress" | "Resolved" | "Closed";
  location: Location;
  imageUrl: string;
  reportedBy: string;
  reportedAt: string;
  upvotes: number;
  downvotes: number;
  verifiedBy: string[]; // local user tokens or IDs
  aiAnalysis: AIAnalysis | null;
  summary: string | null;
  actionPlan: string[] | null;
}

export interface Comment {
  id: string;
  complaintId: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface DashboardStats {
  total: number;
  resolved: number;
  inProgress: number;
  pending: number;
  highPriority: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byDepartment: Record<string, number>;
  topAffectedLocations: { address: string; count: number; upvotes: number }[];
  verificationStats: {
    totalUpvotes: number;
    totalDownvotes: number;
    verifiedCount: number;
    unverifiedCount: number;
  };
  monthlyTrends: { month: string; count: number }[];
}
