interface ExampleResponse {
  customer_response?: string;
  value: any;
}

export default interface MessageContext {
  service_request_id?: string;
  field?: string;
  example_responses?: ExampleResponse[];
}
