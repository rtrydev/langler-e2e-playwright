import type { APIRequestContext } from "@playwright/test";
import { testConfig } from "./config";

interface InitiateAuthResponse {
  AuthenticationResult?: { AccessToken?: string; IdToken?: string };
  ChallengeName?: string;
}

export async function fetchAccessToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(
    `https://cognito-idp.${testConfig.awsRegion}.amazonaws.com/`,
    {
      headers: {
        "content-type": "application/x-amz-json-1.1",
        "x-amz-target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      data: {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: testConfig.cognitoClientId,
        AuthParameters: {
          USERNAME: testConfig.email,
          PASSWORD: testConfig.password,
        },
      },
    },
  );

  if (!response.ok()) {
    throw new Error(
      `Cognito InitiateAuth failed (${response.status()}): ${await response.text()}`,
    );
  }

  const body = (await response.json()) as InitiateAuthResponse;
  if (body.ChallengeName) {
    throw new Error(
      `Cognito returned challenge ${body.ChallengeName}; the E2E user must have a permanent password.`,
    );
  }
  const token = body.AuthenticationResult?.AccessToken;
  if (!token) {
    throw new Error("Cognito InitiateAuth returned no access token.");
  }
  return token;
}
