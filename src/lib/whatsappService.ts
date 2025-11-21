interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: string;
      parameters: Array<{
        type: string;
        text: string;
      }>;
    }>;
  };
}

interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

// Custom error class for WhatsApp API errors
export class WhatsAppError extends Error {
  public readonly code: number;
  public readonly type: string;
  public readonly isRecipientNotAllowed: boolean;
  public readonly phoneNumber?: string;

  constructor(
    message: string,
    code: number,
    type: string = 'WhatsAppError',
    phoneNumber?: string
  ) {
    super(message);
    this.name = 'WhatsAppError';
    this.code = code;
    this.type = type;
    this.isRecipientNotAllowed = code === 131030;
    this.phoneNumber = phoneNumber;
  }

  getInstructions(): string {
    if (this.isRecipientNotAllowed) {
      return `To resolve this issue:
1. Go to your Meta Developer Dashboard
2. Navigate to WhatsApp > API Setup
3. Under "Send and receive messages", click "Manage phone number list"
4. Add the phone number: ${this.phoneNumber}
5. Verify the number using the confirmation code sent to WhatsApp
6. Try the operation again

Note: During testing phase, you can only send messages to up to 5 pre-approved phone numbers.`;
    }
    return 'Please check the WhatsApp API documentation for more information.';
  }
}

class WhatsAppService {
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly businessId: string;
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';

  constructor() {
    this.accessToken = import.meta.env.VITE_WHATSAPP_TOKEN;
    this.phoneNumberId = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
    this.businessId = import.meta.env.VITE_WHATSAPP_BUSINESS_ID;

    if (!this.accessToken || !this.phoneNumberId || !this.businessId) {
      throw new Error('WhatsApp API credentials are missing in environment variables');
    }
  }

  private async sendMessage(message: WhatsAppMessage): Promise<WhatsAppResponse> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        ...message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      // Extract error details
      const error = errorData.error || {};
      const errorCode = error.code || response.status;
      const errorMessage = error.message || `HTTP ${response.status}`;
      const errorType = error.type || 'APIError';
      
      // Create custom error with phone number for better debugging
      throw new WhatsAppError(
        errorMessage,
        errorCode,
        errorType,
        message.to
      );
    }

    return response.json();
  }

  // Format phone number to WhatsApp format (remove + and spaces)
  private formatPhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/[\s+\-()]/g, '');
  }

  // Send welcome message for new user registration
  async sendWelcomeMessage(phoneNumber: string, userName: string): Promise<void> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const message: WhatsAppMessage = {
        to: formattedPhone,
        type: 'text',
        text: {
          body: `🎉 Welcome to Surabhi Loyalty Program, ${userName}! 

Thank you for joining our loyalty program. You can now:
• Earn points on every purchase
• Get exclusive discounts and offers
• Track your rewards and transactions

Start earning rewards today! 💎`,
        },
      };

      await this.sendMessage(message);
      console.log(`Welcome message sent to ${phoneNumber}`);
    } catch (error) {
      if (error instanceof WhatsAppError && error.isRecipientNotAllowed) {
        console.warn(`WhatsApp recipient not allowed: ${phoneNumber}`);
        console.warn(error.getInstructions());
        // Re-throw with additional context
        throw new WhatsAppError(
          `Cannot send welcome message: ${error.message}`,
          error.code,
          error.type,
          phoneNumber
        );
      }
      console.error('Failed to send welcome message:', error);
      throw error;
    }
  }

  // Send recharge confirmation message
  async sendRechargeConfirmation(
    phoneNumber: string,
    userName: string,
    amount: number,
    surabhiCoinsEarned: number,
    sevaAmountEarned: number
  ): Promise<void> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const message: WhatsAppMessage = {
        to: formattedPhone,
        type: 'text',
        text: {
          body: `💰 Recharge Successful!

Hi ${userName},

Your account has been recharged successfully:
• Amount: ₹${amount}
• Surabhi Coins Earned: ${surabhiCoinsEarned}
• Seva Amount Earned: ₹${sevaAmountEarned}
• Date: ${new Date().toLocaleDateString('en-IN')}

Thank you for using Surabhi Loyalty Program! 🙏`,
        },
      };

      await this.sendMessage(message);
      console.log(`Recharge confirmation sent to ${phoneNumber}`);
    } catch (error) {
      if (error instanceof WhatsAppError && error.isRecipientNotAllowed) {
        console.warn(`WhatsApp recipient not allowed: ${phoneNumber}`);
        console.warn(error.getInstructions());
        // Re-throw with additional context
        throw new WhatsAppError(
          `Cannot send recharge confirmation: ${error.message}`,
          error.code,
          error.type,
          phoneNumber
        );
      }
      console.error('Failed to send recharge confirmation:', error);
      throw error;
    }
  }

  // Send sale transaction confirmation
  async sendSaleConfirmation(
    phoneNumber: string,
    userName: string,
    saleAmount: number,
    paymentMethod: string,
    surabhiCoinsUsed: number
  ): Promise<void> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const message: WhatsAppMessage = {
        to: formattedPhone,
        type: 'text',
        text: {
          body: `🛍️ Purchase Confirmed!

Hi ${userName},

Your purchase has been processed:
• Amount: ₹${saleAmount}
• Payment Method: ${paymentMethod}${surabhiCoinsUsed > 0 ? `
• Surabhi Coins Used: ${surabhiCoinsUsed}` : ''}
• Date: ${new Date().toLocaleDateString('en-IN')}

Thank you for shopping with us! 🎁`,
        },
      };

      await this.sendMessage(message);
      console.log(`Sale confirmation sent to ${phoneNumber}`);
    } catch (error) {
      if (error instanceof WhatsAppError && error.isRecipientNotAllowed) {
        console.warn(`WhatsApp recipient not allowed: ${phoneNumber}`);
        console.warn(error.getInstructions());
        // Re-throw with additional context
        throw new WhatsAppError(
          `Cannot send sale confirmation: ${error.message}`,
          error.code,
          error.type,
          phoneNumber
        );
      }
      console.error('Failed to send sale confirmation:', error);
      throw error;
    }
  }

  // Send custom message
  async sendCustomMessage(phoneNumber: string, message: string): Promise<void> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const whatsappMessage: WhatsAppMessage = {
        to: formattedPhone,
        type: 'text',
        text: {
          body: message,
        },
      };

      await this.sendMessage(whatsappMessage);
      console.log(`Custom message sent to ${phoneNumber}`);
    } catch (error) {
      if (error instanceof WhatsAppError && error.isRecipientNotAllowed) {
        console.warn(`WhatsApp recipient not allowed: ${phoneNumber}`);
        console.warn(error.getInstructions());
        // Re-throw with additional context
        throw new WhatsAppError(
          `Cannot send custom message: ${error.message}`,
          error.code,
          error.type,
          phoneNumber
        );
      }
      console.error('Failed to send custom message:', error);
      throw error;
    }
  }

  // Phone Number Registration Methods
  
  /**
   * Step 1: Create a phone number on the WhatsApp Business Account
   * @param phoneNumber - The phone number to create (in E.164 format, e.g., +1234567890)
   * @param displayName - Display name for the phone number (optional, defaults to business name)
   * @returns Promise with the created phone number ID
   */
  async createPhoneNumber(phoneNumber: string, displayName?: string): Promise<string> {
    try {
      const url = `https://graph.facebook.com/v22.0/${this.businessId}/phone_numbers`;
      
      // Parse phone number to extract country code and number
      const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
      let countryCode: string;
      let phoneNumberOnly: string;
      
      if (cleanNumber.startsWith('+91')) {
        countryCode = '91';
        phoneNumberOnly = cleanNumber.substring(3);
      } else if (cleanNumber.startsWith('+1')) {
        countryCode = '1';
        phoneNumberOnly = cleanNumber.substring(2);
      } else if (cleanNumber.startsWith('+')) {
        // Extract country code (assuming 1-3 digits)
        const match = cleanNumber.match(/^\+(\d{1,3})(\d+)$/);
        if (match) {
          countryCode = match[1];
          phoneNumberOnly = match[2];
        } else {
          throw new Error('Invalid phone number format');
        }
      } else {
        throw new Error('Phone number must include country code (e.g., +91xxxxxxxxxx)');
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          country_code: countryCode,
          phone_number: phoneNumberOnly,
          display_name: displayName || 'Surabhi Loyalty Program'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new WhatsAppError(
          `Failed to create phone number: ${errorData.error?.message || 'Unknown error'}`,
          response.status,
          'PhoneNumberCreationError',
          phoneNumber
        );
      }

      const data = await response.json();
      return data.id; // Returns the phone number ID
    } catch (error) {
      if (error instanceof WhatsAppError) {
        throw error;
      }
      console.error('Failed to create phone number:', error);
      throw new WhatsAppError(
        `Phone number creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'PhoneNumberCreationError',
        phoneNumber
      );
    }
  }

  /**
   * Step 2: Request verification code for the phone number
   * @param phoneNumberId - The ID of the phone number to verify
   * @param method - Verification method ('SMS' or 'VOICE')
   * @returns Promise indicating success
   */
  async requestVerificationCode(phoneNumberId: string, method: 'SMS' | 'VOICE' = 'SMS'): Promise<void> {
    try {
      const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/request_code`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code_method: method,
          language: 'en_US'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new WhatsAppError(
          `Failed to request verification code: ${errorData.error?.message || 'Unknown error'}`,
          response.status,
          'VerificationCodeRequestError',
          phoneNumberId
        );
      }
    } catch (error) {
      if (error instanceof WhatsAppError) {
        throw error;
      }
      console.error('Failed to request verification code:', error);
      throw new WhatsAppError(
        `Verification code request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'VerificationCodeRequestError',
        phoneNumberId
      );
    }
  }

  /**
   * Step 3: Verify the phone number with the received code
   * @param phoneNumberId - The ID of the phone number to verify
   * @param verificationCode - The verification code received via SMS/Voice
   * @returns Promise indicating success
   */
  async verifyPhoneNumber(phoneNumberId: string, verificationCode: string): Promise<void> {
    try {
      const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/verify_code`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: verificationCode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new WhatsAppError(
          `Failed to verify phone number: ${errorData.error?.message || 'Unknown error'}`,
          response.status,
          'PhoneNumberVerificationError',
          phoneNumberId
        );
      }
    } catch (error) {
      if (error instanceof WhatsAppError) {
        throw error;
      }
      console.error('Failed to verify phone number:', error);
      throw new WhatsAppError(
        `Phone number verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'PhoneNumberVerificationError',
        phoneNumberId
      );
    }
  }

  /**
   * Step 4: Register the verified phone number for use with Cloud API
   * @param phoneNumberId - The ID of the verified phone number
   * @param pin - Optional 6-digit PIN for two-step verification
   * @returns Promise indicating success
   */
  async registerPhoneNumber(phoneNumberId: string, pin?: string): Promise<void> {
    try {
      const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/register`;
      
      const body: any = {
        messaging_product: 'whatsapp'
      };
      
      if (pin) {
        body.pin = pin;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new WhatsAppError(
          `Failed to register phone number: ${errorData.error?.message || 'Unknown error'}`,
          response.status,
          'PhoneNumberRegistrationError',
          phoneNumberId
        );
      }
    } catch (error) {
      if (error instanceof WhatsAppError) {
        throw error;
      }
      console.error('Failed to register phone number:', error);
      throw new WhatsAppError(
        `Phone number registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'PhoneNumberRegistrationError',
        phoneNumberId
      );
    }
  }

  /**
   * Complete phone number registration process (all 4 steps)
   * @param phoneNumber - The phone number to register (in E.164 format)
   * @param verificationCode - The verification code (will be requested if not provided)
   * @param method - Verification method ('SMS' or 'VOICE')
   * @param pin - Optional 6-digit PIN for two-step verification
   * @returns Promise with the registered phone number ID
   */
  async completePhoneNumberRegistration(
    phoneNumber: string, 
    verificationCode?: string, 
    method: 'SMS' | 'VOICE' = 'SMS',
    pin?: string
  ): Promise<string> {
    try {
      // Step 1: Create phone number
      const phoneNumberId = await this.createPhoneNumber(phoneNumber);
      
      // Step 2: Request verification code (if not provided)
      if (!verificationCode) {
        await this.requestVerificationCode(phoneNumberId, method);
        throw new WhatsAppError(
          'Verification code has been sent. Please provide the code to complete registration.',
          200,
          'VerificationCodeSent',
          phoneNumber
        );
      }
      
      // Step 3: Verify phone number
      await this.verifyPhoneNumber(phoneNumberId, verificationCode);
      
      // Step 4: Register phone number
      await this.registerPhoneNumber(phoneNumberId, pin);
      
      return phoneNumberId;
    } catch (error) {
      if (error instanceof WhatsAppError) {
        throw error;
      }
      console.error('Failed to complete phone number registration:', error);
      throw new WhatsAppError(
        `Phone number registration process failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'PhoneNumberRegistrationProcessError',
        phoneNumber
      );
    }
  }

  /**
   * Enhanced phone number registration workflow with step-by-step control
   * @param phoneNumber - The phone number to register (in E.164 format)
   * @param displayName - Display name for the phone number
   * @param verificationMethod - Verification method ('SMS' or 'VOICE')
   * @returns Promise with workflow status and phone number ID
   */
  async startPhoneNumberRegistrationWorkflow(
    phoneNumber: string,
    displayName: string,
    verificationMethod: 'SMS' | 'VOICE' = 'SMS'
  ): Promise<{
    success: boolean;
    phoneNumberId: string;
    step: 'created' | 'verification_requested';
    message: string;
  }> {
    try {
      // Step 1: Create phone number
      const phoneNumberId = await this.createPhoneNumber(phoneNumber, displayName);
      
      // Step 2: Request verification code
      await this.requestVerificationCode(phoneNumberId, verificationMethod);
      
      return {
        success: true,
        phoneNumberId,
        step: 'verification_requested',
        message: `Verification code has been sent via ${verificationMethod}. Please check your device and enter the code.`
      };
    } catch (error) {
      console.error('Failed to start phone number registration workflow:', error);
      throw new WhatsAppError(
        `Failed to start registration workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'WorkflowStartError',
        phoneNumber
      );
    }
  }

  /**
   * Complete phone number registration workflow with verification code
   * @param phoneNumberId - The phone number ID from the first step
   * @param verificationCode - The verification code received
   * @param pin - Optional 6-digit PIN for two-step verification
   * @returns Promise with completion status
   */
  async completePhoneNumberRegistrationWorkflow(
    phoneNumberId: string,
    verificationCode: string,
    pin?: string
  ): Promise<{
    success: boolean;
    phoneNumberId: string;
    message: string;
  }> {
    try {
      // Step 3: Verify phone number
      await this.verifyPhoneNumber(phoneNumberId, verificationCode);
      
      // Step 4: Register phone number
      await this.registerPhoneNumber(phoneNumberId, pin);
      
      return {
        success: true,
        phoneNumberId,
        message: 'Phone number has been successfully registered and is ready to use.'
      };
    } catch (error) {
      console.error('Failed to complete phone number registration workflow:', error);
      throw new WhatsAppError(
        `Failed to complete registration workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'WorkflowCompletionError',
        phoneNumberId
      );
    }
  }

  // Check if recipient is in allowed list by attempting a test message
  async isRecipientAllowed(phoneNumber: string): Promise<boolean> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Try to send a minimal test message to check if recipient is allowed
      const testMessage: WhatsAppMessage = {
        to: formattedPhone,
        type: 'text',
        text: {
          body: 'Test message - please ignore'
        }
      };

      await this.sendMessage(testMessage);
      return true;
    } catch (error) {
      if (error instanceof WhatsAppError && error.isRecipientNotAllowed) {
        return false;
      }
      // For other errors, assume recipient might be allowed but there's another issue
      console.warn('Error checking recipient status:', error);
      return true;
    }
  }

  // Add recipient to allowed list (for test numbers only)
  // Note: This requires manual intervention through Meta Developer Console
  async addRecipientToAllowedList(phoneNumber: string): Promise<{success: boolean, requiresManualAction: boolean, instructions: string}> {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    
    // Check if recipient is already allowed
    const isAllowed = await this.isRecipientAllowed(phoneNumber);
    if (isAllowed) {
      return {
        success: true,
        requiresManualAction: false,
        instructions: 'Recipient is already in the allowed list.'
      };
    }

    // For test phone numbers, we cannot programmatically add recipients
    // Return instructions for manual addition
    const instructions = `
To add ${formattedPhone} to the allowed recipients list:

1. Go to Meta Developer Console (developers.facebook.com)
2. Navigate to your app > WhatsApp > API Setup
3. Under "Send and receive messages", click "Manage phone number list"
4. Add the phone number: ${formattedPhone}
5. Verify the number using the confirmation code sent to WhatsApp
6. Try sending the message again

Note: Test phone numbers can only have up to 5 recipients in the allowed list.
For production, use a verified business phone number to remove this limitation.`;

    return {
      success: false,
      requiresManualAction: true,
      instructions
    };
  }

  // Send welcome message with automatic recipient verification
  async sendWelcomeMessageWithVerification(phoneNumber: string, userName: string): Promise<{sent: boolean, requiresManualAction: boolean, instructions?: string}> {
    try {
      // First, try to send the welcome message normally
      await this.sendWelcomeMessage(phoneNumber, userName);
      return {
        sent: true,
        requiresManualAction: false
      };
    } catch (error) {
      if (error instanceof WhatsAppError && error.isRecipientNotAllowed) {
        // Attempt to add recipient to allowed list
        const addResult = await this.addRecipientToAllowedList(phoneNumber);
        
        if (addResult.success) {
          // Try sending the message again
          try {
            await this.sendWelcomeMessage(phoneNumber, userName);
            return {
              sent: true,
              requiresManualAction: false
            };
          } catch (retryError) {
            console.error('Failed to send message after adding to allowed list:', retryError);
            return {
              sent: false,
              requiresManualAction: true,
              instructions: addResult.instructions
            };
          }
        } else {
          return {
            sent: false,
            requiresManualAction: true,
            instructions: addResult.instructions
          };
        }
      }
      
      // For other errors, re-throw
      throw error;
    }
  }

  // Get all phone numbers associated with the WhatsApp Business Account
  async getPhoneNumbers(): Promise<{
    success: boolean;
    phoneNumbers?: Array<{
      id: string;
      display_phone_number: string;
      verified_name: string;
      status: string;
    }>;
    error?: string;
  }> {
    try {
      const url = `https://graph.facebook.com/v22.0/${this.businessId}/phone_numbers`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || `HTTP ${response.status}`
        };
      }

      const data = await response.json();
      return {
        success: true,
        phoneNumbers: data.data || []
      };
    } catch (error) {
      console.error('Failed to retrieve phone numbers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Register an existing phone number using the new API endpoints
   * @param phoneNumber - The phone number to register (in E.164 format)
   * @param pin - 6-digit PIN for two-step verification
   * @returns Promise with registration result
   */
  async registerExistingPhoneNumber(phoneNumber: string, pin: string): Promise<{
    success: boolean;
    phoneNumberId?: string;
    message?: string;
    error?: string;
  }> {
    try {
      // First, get all phone numbers to find the one we want to register
      const phoneNumbersResult = await this.getPhoneNumbers();
      
      if (!phoneNumbersResult.success) {
        return {
          success: false,
          error: `Failed to retrieve phone numbers: ${phoneNumbersResult.error}`
        };
      }

      // Find the phone number that matches (remove formatting for comparison)
      const formattedTargetPhone = this.formatPhoneNumber(phoneNumber);
      const targetPhoneNumber = phoneNumbersResult.phoneNumbers?.find(pn => 
        this.formatPhoneNumber(pn.display_phone_number) === formattedTargetPhone
      );

      if (!targetPhoneNumber) {
        return {
          success: false,
          error: `Phone number ${phoneNumber} not found in your WhatsApp Business Account. Please add it first in Meta Business Manager.`
        };
      }

      // Register the phone number using the /register endpoint
      try {
        const url = `https://graph.facebook.com/v22.0/${targetPhoneNumber.id}/register`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            pin: pin
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          return {
            success: false,
            error: errorData.error?.message || `HTTP ${response.status}`
          };
        }

        return {
          success: true,
          phoneNumberId: targetPhoneNumber.id,
          message: `Phone number ${phoneNumber} has been successfully registered and 2FA has been set up.`
        };
      } catch (error) {
        console.error('Failed to register phone number:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } catch (error) {
      console.error('Failed to register existing phone number:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Test connection to WhatsApp API
  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/${this.phoneNumberId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('WhatsApp API connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService();
export default whatsappService;
