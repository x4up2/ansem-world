const headers = {
  "Content-Type": "application/json",
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      {
        status: 405,
        headers,
      },
    );
  }

  const githubToken = Deno.env.get("GITHUB_ACTIONS_PAT");
  const expectedCronSecret = Deno.env.get("CRON_TRIGGER_SECRET");
  const suppliedCronSecret = request.headers.get("x-cron-secret");

  if (!githubToken || !expectedCronSecret) {
    console.error("Required environment variables are missing.");

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Server configuration error",
      }),
      {
        status: 500,
        headers,
      },
    );
  }

  if (suppliedCronSecret !== expectedCronSecret) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Unauthorized",
      }),
      {
        status: 401,
        headers,
      },
    );
  }

  try {
    const githubResponse = await fetch(
      "https://api.github.com/repos/x4up2/ansem-world/actions/workflows/update-holder-snapshot.yml/dispatches",
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
          "User-Agent": "ansem-world-supabase-cron",
          "X-GitHub-Api-Version": "2026-03-10",
        },
        body: JSON.stringify({
          ref: "main",
        }),
      },
    );

    const responseText = await githubResponse.text();

    let githubResponseBody: unknown = null;

    if (responseText) {
      try {
        githubResponseBody = JSON.parse(responseText);
      } catch {
        githubResponseBody = responseText;
      }
    }

    if (!githubResponse.ok) {
      console.error(
        `GitHub dispatch failed with status ${githubResponse.status}`,
      );

      return new Response(
        JSON.stringify({
          ok: false,
          githubStatus: githubResponse.status,
          githubResponse: githubResponseBody,
        }),
        {
          status: 502,
          headers,
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        githubStatus: githubResponse.status,
        workflowRun: githubResponseBody,
      }),
      {
        status: 200,
        headers,
      },
    );
  } catch (error) {
    console.error("GitHub request failed:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Unable to contact GitHub",
      }),
      {
        status: 502,
        headers,
      },
    );
  }
});
