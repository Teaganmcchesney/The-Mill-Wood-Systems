export type Role = "admin" | "supervisor" | "shop_user";
export type WallStatus = "queued" | "in_progress" | "complete";

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  production_line_id: string | null;
};

export type ProductionLine = {
  id: string;
  name: string;
  sort_order: number;
  crew_count?: number | null;
};

export type ShiftManpower = {
  id: string;
  production_line_id: string;
  shift_date: string;
  shift_name: string;
  crew_count: number;
  shift_hours: number;
};

export type Project = {
  id: string;
  name: string;
  code: string;
  drawing_pdf_url: string | null;
};

export type PdfPage = {
  id: string;
  project_id: string;
  page_number: number;
  image_url: string;
};

export type WallPanel = {
  id: string;
  project_id: string;
  wall_id: string;
  wall_type: string;
  level: string;
  area_sqft: number;
  lineal_feet: number;
  pdf_page_id: string | null;
  production_line_id: string;
  status: WallStatus;
  sort_order: number;
};
