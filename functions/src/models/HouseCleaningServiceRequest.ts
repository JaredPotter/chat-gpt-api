import ChatGptService from "../ChatGptService";
import ServiceType from "../enums/ServiceType";
import BaseServiceRequest from "./BaseServiceRequest";
import MessageContext from "./MessageContext";

interface HouseCleaningDetails {
  square_footage: number | null;
  extra_cleaning_attention: string | null;
  are_children: boolean;
  are_pets: boolean;
  pet_details: string;
  number_of_bedrooms: number | null;
  number_of_bathrooms: number | null;
  number_of_residents: number | null;
  rooms_not_to_clean: string;
  unattended_cleaning: boolean;
  unattended_details: string;
}

export default class HouseCleaningServiceRequest extends BaseServiceRequest {
  // BaseServiceRequest Properties
  id = "";
  service_type = ServiceType.HouseCleaning;
  customer_person_id = "";
  customer_conversation_id = "";
  is_waiting_for_customer_response = true;
  is_ready_to_start = false;
  is_recurring = null;
  recurring_details = null;
  dollar_rate_per_hour = null;
  estimated_total_dollar_cost = null;
  due_date = null;
  special_notes = null;
  address_line_one = null;
  address_line_two = null;
  postal_code = null;
  city = null;
  state = null;
  vendor_id = null;
  special_details = null;
  created_at_unix = 0;
  updated_at_unix = 0;
  completd_at_unix = null;

  // HouseCleaning Properties
  house_cleaning_details: HouseCleaningDetails = {
    square_footage: null,
    extra_cleaning_attention: null,
    are_children: false,
    are_pets: false,
    pet_details: "",
    number_of_bedrooms: null,
    number_of_bathrooms: null,
    number_of_residents: null,
    rooms_not_to_clean: "",
    unattended_cleaning: false,
    unattended_details: "",
  };

  constructor(
    // id: string = "",
    // customerPersonId: string = "",
    // customerConversationId: string = ""
    existingServiceRequest: any = null
  ) {
    super();

    if (existingServiceRequest) {
      this.id = existingServiceRequest.id;
      this.service_type = existingServiceRequest.service_type;
      this.customer_person_id = existingServiceRequest.customer_person_id;
      this.customer_conversation_id =
        existingServiceRequest.customer_conversation_id;
      this.is_waiting_for_customer_response =
        existingServiceRequest.is_waiting_for_customer_response;
      this.is_ready_to_start = existingServiceRequest.is_ready_to_start;
      this.is_recurring = existingServiceRequest.is_recurring;
      this.recurring_details = existingServiceRequest.recurring_details;
      this.dollar_rate_per_hour = existingServiceRequest.dollar_rate_per_hour;
      this.estimated_total_dollar_cost =
        existingServiceRequest.estimated_total_dollar_cost;
      this.due_date = existingServiceRequest.due_date;
      this.special_notes = existingServiceRequest.special_notes;
      this.address_line_one = existingServiceRequest.address_line_one;
      this.address_line_two = existingServiceRequest.address_line_two;
      this.postal_code = existingServiceRequest.postal_code;
      this.city = existingServiceRequest.city;
      this.state = existingServiceRequest.state;
      this.vendor_id = existingServiceRequest.vendor_id;
      this.special_details = existingServiceRequest.special_details;
      this.created_at_unix = existingServiceRequest.created_at_unix;
      this.updated_at_unix = existingServiceRequest.updated_at_unix;
      this.completd_at_unix = existingServiceRequest.completd_at_unix;
      this.house_cleaning_details = {
        square_footage:
          existingServiceRequest.house_cleaning_details.square_footage,
        extra_cleaning_attention:
          existingServiceRequest.house_cleaning_details
            .extra_cleaning_attention,
        are_children:
          existingServiceRequest.house_cleaning_details.are_children,
        are_pets: existingServiceRequest.house_cleaning_details.are_pets,
        pet_details: existingServiceRequest.house_cleaning_details.pet_details,
        number_of_bedrooms:
          existingServiceRequest.house_cleaning_details.number_of_bedrooms,
        number_of_bathrooms:
          existingServiceRequest.house_cleaning_details.number_of_bathrooms,
        number_of_residents:
          existingServiceRequest.house_cleaning_details.number_of_residents,
        rooms_not_to_clean:
          existingServiceRequest.house_cleaning_details.rooms_not_to_clean,
        unattended_cleaning:
          existingServiceRequest.house_cleaning_details.unattended_cleaning,
        unattended_details:
          existingServiceRequest.house_cleaning_details.unattended_details,
      };
    }
  }

  public async getNextCustomerQuestionMessage(): Promise<{
    next_customer_question: string;
    context: MessageContext;
  }> {
    let message = {
      next_customer_question: "",
      context: {},
    };

    if (this.is_recurring === null) {
      let query = `
        Help me write a short message to a customer of my concierge business.
        I want to ask the customer if they want a weekly/biweekly recurring cleaning
        or just a one time cleaning.
        Also make the message tone a medium 75% casual and 25% professional. 
        The message should be less than 10 words.
        Be direct in the question and do not include any introductory "Hey There" or similar.
        The result should be in a json code block. 
        A field called 'message_to_customer' should have the value of the composed message. No explaination necessary.
        Double check that the json is valid.
        `;

      message.next_customer_question = (
        await ChatGptService.queryChatGpt(query)
      ).message_to_customer;

      message.context = {
        service_request_id: this.id,
        field: "is_recurring",
        special_instructions: `The json response should have a 'is_recurring' field and the 'value' should either true boolean type or false boolean type based on the customer's message.`,
        example_responses: [
          {
            customer_response: "Only once",
            value: false,
          },
          {
            customer_response: "Yes let's make it regular.",
            value: true,
          },
          {
            customer_response: "No - only one time",
            value: false,
          },
          {
            customer_response: "No - only one time",
            value: false,
          },
          {
            customer_response: "I'd like a regular cleaning",
            value: true,
          },
        ],
      };
    } else if (this.house_cleaning_details.square_footage === null) {
      let query = `
        Help me write a short message to a customer of my concierge business.
        I want to ask the customer the square footage of their home/apartment.
        Also make the message casual tone. 
        The message should be less than 6 words.
        Be direct in the question and do not include any introductory "Hey There" or similar.
        The result should be in a json code block. 
        A field called 'message_to_customer' should have the value of the composed message. No explaination necessary.
        Double check that the json is valid.
        `;

      message.next_customer_question = (
        await ChatGptService.queryChatGpt(query)
      ).message_to_customer;

      message.context = {
        service_request_id: this.id,
        field: "house_cleaning_details.square_footage",
        special_instructions: `The json response should have a 'house_cleaning_details' object with a 'square_footage' field with a 'value' of the square footage from the customer message as a numeric type.
            The example_responses show examples of customer language text responses of square footage and the 'value' field the numeric value for reference.`,
        example_responses: [
          {
            customer_response: "about 1000",
            value: 1000,
          },
          {
            customer_response: "I think it is 2240 sq",
            value: 2240,
          },
          {
            customer_response: "4000",
            value: 4000,
          },
          {
            customer_response: "200 square feet",
            value: 200,
          },
        ],
      };
    } else if (this.house_cleaning_details.number_of_bedrooms === null) {
      let query = `
        Help me write a short message to a customer of my concierge business.
        I want to ask the customer the how many bedrooms are in their home/apartment.
        Also make the message casual tone. 
        The message should be less than 6 words.
        Be direct in the question and do not include any introductory "Hey There" or similar.
        The result should be in a json code block. 
        A field called 'message_to_customer' should have the value of the composed message. No explaination necessary.
        Double check that the json is valid.
        `;

      message.next_customer_question = (
        await ChatGptService.queryChatGpt(query)
      ).message_to_customer;

      message.context = {
        service_request_id: this.id,
        field: "house_cleaning_details.number_of_bedrooms",
        special_instructions: `The json response should have a field called "house_cleaning_details.number_of_bedrooms' field with a 'value' of the number of bedrooms
        from the customer message as a numeric type. The example_responses show examples of customer language text responses of number_of_bedrooms and the 'value' field the numeric value for reference.`,
        example_responses: [
          {
            customer_response: "two",
            value: 2,
          },
          {
            customer_response: "1 bedroom",
            value: 1,
          },
          {
            customer_response: "exactly 4",
            value: 4,
          },
          {
            customer_response: "five bedrooms",
            value: 5,
          },
        ],
      };
    }

    return message;
  }
}
