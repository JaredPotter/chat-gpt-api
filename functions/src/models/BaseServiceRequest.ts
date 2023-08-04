export default class BaseServiceRequest {
  id: string = "";
  service_type: string | null = null;
  customer_person_id: string = "";
  customer_conversation_id: string = "";
  is_waiting_for_customer_response: boolean = true;
  is_ready_to_start: boolean = false;
  is_recurring?: boolean | null = null;
  recurring_details?: string | null; // "every 2 weeks preferably on wednesdays" OR some programatic way = null;
  dollar_rate_per_hour?: number | null = null;
  estimated_total_dollar_cost?: number | null = null;
  due_date?: number | null; // uni = null;
  special_notes?: string | null = null;
  address_line_one?: string | null = null;
  address_line_two?: string | null = null;
  postal_code?: string | null = null;
  city?: string | null = null;
  state?: string | null = null;
  vendor_id?: string | null = null;
  special_details?: string | null = null;
  created_at_unix: number | null = 0;
  updated_at_unix: number | null = 0;
  completed_at_unix: number | null = null;

  public toFirestore() {
    const now = Date.now();

    if (!this.created_at_unix) {
      this.created_at_unix = now;
    }

    this.updated_at_unix = now;

    return { ...this };
  }
}
