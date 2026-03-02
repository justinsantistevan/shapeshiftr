import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEMO_USER_ID = "59455a40-c945-4b9e-a9c6-f4bc272694f9";

const WEEK_DATA = [
  { date: "2025-12-14", weight: 172.4, bf: 18.5 },
  { date: "2025-12-21", weight: 171.0, bf: 18.2 },
  { date: "2025-12-28", weight: 170.2, bf: 17.8 },
  { date: "2026-01-04", weight: 169.8, bf: 17.5 },
  { date: "2026-01-11", weight: 170.5, bf: 17.8 },
  { date: "2026-01-18", weight: 168.3, bf: 17.1 },
  { date: "2026-01-25", weight: 167.1, bf: 16.7 },
  { date: "2026-02-01", weight: 165.8, bf: 16.3 },
  { date: "2026-02-08", weight: 164.2, bf: 15.9 },
  { date: "2026-02-15", weight: 163.0, bf: 15.5 },
  { date: "2026-02-22", weight: 161.5, bf: 15.0 },
  { date: "2026-03-01", weight: 160.8, bf: 14.5 },
];

function getBodyDescription(weight: number, bf: number): string {
  if (bf >= 18) return "slightly overweight, soft midsection with some belly fat, wider waist";
  if (bf >= 17) return "average build, mild belly fat visible, moderate love handles";
  if (bf >= 16) return "athletic-leaning build, some abdominal definition starting, narrower waist";
  if (bf >= 15) return "fit build, visible upper ab outline, lean arms and shoulders";
  return "lean athletic build, visible abdominal definition, defined arms and shoulders, narrow waist";
}

async function generateImage(prompt: string, apiKey: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) {
      console.error("No image returned from AI gateway");
      return null;
    }

    // Extract base64 data
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("Image generation error:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const batch = parseInt(url.searchParams.get("batch") || "0");
    // Each batch processes 1 week (2 images in parallel)
    if (batch >= WEEK_DATA.length) {
      return new Response(
        JSON.stringify({ error: "Invalid batch number. Use 0-11." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startIdx = batch;
    const endIdx = batch + 1;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: string[] = [];

    for (let i = startIdx; i < endIdx; i++) {
      const week = WEEK_DATA[i];
      const bodyDesc = getBodyDescription(week.weight, week.bf);
      const weekLabel = `Week ${i + 1} of 12`;

      const makePrompt = (view: string) => {
        const viewDesc = view === "front" ? "front-facing view" : "side profile view";
        return `Create a clean, simple body diagram illustration of an adult male, ${viewDesc}. The figure should have a ${bodyDesc}. Style: flat medical/fitness body outline on a plain white background, like a body composition chart. No face details, just a clean silhouette with subtle body contour shading. The figure should be standing straight. Add a small label at the bottom: "${weekLabel} - ${week.weight} lbs / ${week.bf}% BF". Clean, professional, minimal.`;
      };

      // Generate front and side in parallel
      console.log(`Generating photos for ${week.date}...`);
      const [frontBytes, sideBytes] = await Promise.all([
        generateImage(makePrompt("front"), lovableApiKey),
        generateImage(makePrompt("side"), lovableApiKey),
      ]);

      for (const [view, imageBytes] of [["front", frontBytes], ["side", sideBytes]] as const) {
        if (!imageBytes) {
          results.push(`FAILED: ${week.date}/${view}`);
          continue;
        }

        const storagePath = `${DEMO_USER_ID}/${week.date}/${view}.png`;
        const { error: uploadError } = await supabase.storage
          .from("fitness-photos")
          .upload(storagePath, imageBytes, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for ${storagePath}:`, uploadError);
          results.push(`UPLOAD FAILED: ${storagePath}`);
          continue;
        }

        const photoUrl = `${supabaseUrl}/storage/v1/object/fitness-photos/${storagePath}`;
        const updateField = view === "front" ? "front_photo_url" : "side_photo_url";

        const { error: updateError } = await supabase
          .from("weekly_fitness_entries")
          .update({ [updateField]: photoUrl })
          .eq("user_id", DEMO_USER_ID)
          .eq("week_end_date", week.date);

        if (updateError) {
          results.push(`DB UPDATE FAILED: ${week.date}/${view}`);
        } else {
          results.push(`OK: ${week.date}/${view}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch,
        weeksProcessed: `${startIdx}-${endIdx - 1}`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Seed photos error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
