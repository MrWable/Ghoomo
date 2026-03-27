export {};

declare global {
  type GoogleCredentialResponse = {
    credential: string;
    select_by?: string;
  };

  type GoogleAccountsIdConfiguration = {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    button_auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_button?: boolean;
    use_fedcm_for_prompt?: boolean;
  };

  type GoogleButtonConfiguration = {
    type?: "standard" | "icon";
    theme?: "outline" | "filled_blue" | "filled_black";
    size?: "large" | "medium" | "small";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    shape?: "rectangular" | "pill" | "circle" | "square";
    logo_alignment?: "left" | "center";
    width?: number | string;
  };

  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: GoogleAccountsIdConfiguration): void;
          renderButton(
            parent: HTMLElement,
            options: GoogleButtonConfiguration,
          ): void;
        };
      };
    };
  }
}
