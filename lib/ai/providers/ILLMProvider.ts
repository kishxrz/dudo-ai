import { ConversationRequest } from '../types/ConversationRequest';
import { ConversationResponse } from '../types/ConversationResponse';

export interface ILLMProvider {
  generateResponse(request: ConversationRequest): Promise<ConversationResponse>;
}
