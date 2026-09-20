export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: Record<string, string[]>;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthUser {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'ADMIN' | 'MANAGER' | 'TEACHER' | 'STUDENT';
  companyId: string;
  branchId: string | null;
  studentId?: string | null;
  employeeId?: string | null;
}

export interface BranchSummary {
  id: string;
  name: string;
}

export interface Me extends AuthUser {
  company: {
    id: string;
    name: string;
    ownerName: string;
    maxBranches: number;
    branchCount: number;
    trialEndsAt: string;
    subscriptionStartAt?: string;
    subscriptionEndAt?: string;
    createdAt: string;
    logoUrl: string | null;
  };
  branches: BranchSummary[];
}

export interface FileDto {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
}
