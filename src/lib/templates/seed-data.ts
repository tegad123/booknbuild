export interface TemplateJson {
  org_config: {
    pricing: Record<string, unknown>;
    measurement_thresholds: Record<string, unknown>;
    booking: Record<string, unknown>;
  };
  intake_schema: {
    questions: Array<{
      key: string;
      label: string;
      type: "text" | "select" | "number" | "textarea" | "checkbox";
      options?: string[];
      required: boolean;
    }>;
  };
  message_templates: Array<{
    channel: "sms" | "email";
    name: string;
    body: string;
    variables: string[];
  }>;
  followup_rules: Array<{
    trigger: string;
    steps: Array<{
      delay_hours: number;
      channel: "sms" | "email";
      template_name: string;
    }>;
  }>;
  slot_strategy: {
    duration_minutes: number;
    lead_time_hours: number;
    buffer_minutes: number;
    max_per_day: number;
    working_hours: { start: number; end: number };
  };
}

export const FENCE_TEMPLATE: TemplateJson = {
  org_config: {
    pricing: {
      labor_per_lf: 2500, // cents
      materials: {
        wood_4ft: { cost_per_lf: 1200, markup: 1.4 },
        wood_6ft: { cost_per_lf: 1800, markup: 1.4 },
        vinyl_4ft: { cost_per_lf: 2200, markup: 1.3 },
        vinyl_6ft: { cost_per_lf: 3200, markup: 1.3 },
        chain_link_4ft: { cost_per_lf: 800, markup: 1.5 },
        chain_link_6ft: { cost_per_lf: 1200, markup: 1.5 },
      },
      gates: { single_4ft: 45000, double_8ft: 85000 },
      tearout_per_lf: 800,
      hauloff_flat: 20000,
      minimum_fee: 150000,
      multipliers: { corner_post: 1.0, end_post: 1.0 },
    },
    measurement_thresholds: {
      min_lf: 20,
      max_lf: 2000,
      photo_confidence_threshold: 0.6,
      auto_quote_confidence: 0.8,
    },
    booking: {
      deposit_percent: 25,
      deposit_required: true,
      payment_timing: "before_booking",
    },
  },
  intake_schema: {
    questions: [
      {
        key: "fence_material",
        label: "What material are you interested in?",
        type: "select",
        options: ["Wood", "Vinyl", "Chain Link", "Not sure"],
        required: true,
      },
      {
        key: "fence_height",
        label: "Desired fence height?",
        type: "select",
        options: ["4 feet", "6 feet", "Other"],
        required: true,
      },
      {
        key: "needs_tearout",
        label: "Do you have an existing fence that needs removal?",
        type: "select",
        options: ["Yes", "No"],
        required: true,
      },
      {
        key: "gate_count",
        label: "How many gates do you need?",
        type: "number",
        required: false,
      },
      {
        key: "gate_type",
        label: "Gate type?",
        type: "select",
        options: ["Single (4ft)", "Double (8ft)", "Both"],
        required: false,
      },
      {
        key: "additional_notes",
        label: "Anything else we should know?",
        type: "textarea",
        required: false,
      },
    ],
  },
  message_templates: [
    {
      channel: "sms",
      name: "quote_sent",
      body: "Hi {{name}}! Your fence quote from {{company}} is ready. View it here: {{quote_link}}",
      variables: ["name", "company", "quote_link"],
    },
    {
      channel: "email",
      name: "quote_sent",
      body: "Hi {{name}},\n\nYour custom fence quote is ready! Click below to view your options:\n\n{{quote_link}}\n\nQuestions? Reply to this email.\n\nBest,\n{{company}}",
      variables: ["name", "company", "quote_link"],
    },
    {
      channel: "sms",
      name: "followup_1",
      body: "Hey {{name}}, just checking in! Did you get a chance to look at your fence quote? {{quote_link}}",
      variables: ["name", "quote_link"],
    },
    {
      channel: "sms",
      name: "booking_confirmed",
      body: "{{name}}, your fence installation is confirmed for {{date}} at {{time}}. See you then! - {{company}}",
      variables: ["name", "date", "time", "company"],
    },
  ],
  followup_rules: [
    {
      trigger: "quote_sent",
      steps: [
        { delay_hours: 24, channel: "sms", template_name: "followup_1" },
        { delay_hours: 72, channel: "email", template_name: "quote_sent" },
      ],
    },
  ],
  slot_strategy: {
    duration_minutes: 120,
    lead_time_hours: 48,
    buffer_minutes: 30,
    max_per_day: 3,
    working_hours: { start: 8, end: 17 },
  },
};

export const ROOF_TEMPLATE: TemplateJson = {
  org_config: {
    pricing: {
      labor_per_sq: 7500, // cents per square (100 sqft)
      materials: {
        asphalt_3tab: { cost_per_sq: 9000, markup: 1.35 },
        asphalt_architectural: { cost_per_sq: 12000, markup: 1.3 },
        metal_standing_seam: { cost_per_sq: 35000, markup: 1.25 },
      },
      tearoff_per_sq: 5000,
      pitch_multipliers: {
        "4/12": 1.0,
        "6/12": 1.1,
        "8/12": 1.2,
        "10/12": 1.35,
        "12/12": 1.5,
      },
      decking_allowance_per_sq: 3000,
      minimum_fee: 500000,
    },
    measurement_thresholds: {
      min_squares: 5,
      max_squares: 100,
      photo_confidence_threshold: 0.5,
      auto_quote_confidence: 0.75,
    },
    booking: {
      deposit_percent: 30,
      deposit_required: true,
      payment_timing: "before_booking",
    },
  },
  intake_schema: {
    questions: [
      {
        key: "roof_type",
        label: "What type of roofing are you interested in?",
        type: "select",
        options: [
          "Asphalt 3-Tab",
          "Asphalt Architectural",
          "Metal Standing Seam",
          "Not sure",
        ],
        required: true,
      },
      {
        key: "needs_tearoff",
        label: "Does the existing roof need to be torn off?",
        type: "select",
        options: ["Yes", "No", "Not sure"],
        required: true,
      },
      {
        key: "roof_pitch",
        label: "Do you know your roof pitch?",
        type: "select",
        options: ["Low (4/12)", "Medium (6/12)", "Steep (8/12+)", "Not sure"],
        required: false,
      },
      {
        key: "roof_issues",
        label: "Any known issues? (leaks, rot, sagging)",
        type: "textarea",
        required: false,
      },
      {
        key: "additional_notes",
        label: "Anything else we should know?",
        type: "textarea",
        required: false,
      },
    ],
  },
  message_templates: [
    {
      channel: "sms",
      name: "quote_sent",
      body: "Hi {{name}}! Your roofing quote from {{company}} is ready. View it here: {{quote_link}}",
      variables: ["name", "company", "quote_link"],
    },
    {
      channel: "email",
      name: "quote_sent",
      body: "Hi {{name}},\n\nYour custom roofing quote is ready! Click below to view your options:\n\n{{quote_link}}\n\nQuestions? Reply to this email.\n\nBest,\n{{company}}",
      variables: ["name", "company", "quote_link"],
    },
    {
      channel: "sms",
      name: "followup_1",
      body: "Hey {{name}}, just following up on your roofing quote. Any questions? {{quote_link}}",
      variables: ["name", "quote_link"],
    },
    {
      channel: "sms",
      name: "booking_confirmed",
      body: "{{name}}, your roofing job is confirmed for {{date}}. We'll arrive around {{time}}. - {{company}}",
      variables: ["name", "date", "time", "company"],
    },
  ],
  followup_rules: [
    {
      trigger: "quote_sent",
      steps: [
        { delay_hours: 24, channel: "sms", template_name: "followup_1" },
        { delay_hours: 72, channel: "email", template_name: "quote_sent" },
      ],
    },
  ],
  slot_strategy: {
    duration_minutes: 480,
    lead_time_hours: 72,
    buffer_minutes: 0,
    max_per_day: 1,
    working_hours: { start: 7, end: 17 },
  },
};

export const CONCRETE_TEMPLATE: TemplateJson = {
  org_config: {
    pricing: {
      labor_per_sqft: 350, // cents
      materials: {
        standard_4in: { cost_per_sqft: 450, markup: 1.35 },
        standard_6in: { cost_per_sqft: 600, markup: 1.3 },
      },
      rebar_per_sqft: 150,
      mesh_per_sqft: 75,
      demo_per_sqft: 300,
      finish_options: {
        broom: 0,
        stamped: 250,
        exposed_aggregate: 200,
        polished: 400,
      },
      minimum_fee: 250000,
    },
    measurement_thresholds: {
      min_sqft: 50,
      max_sqft: 10000,
      photo_confidence_threshold: 0.5,
      auto_quote_confidence: 0.75,
    },
    booking: {
      deposit_percent: 30,
      deposit_required: true,
      payment_timing: "before_booking",
    },
  },
  intake_schema: {
    questions: [
      {
        key: "concrete_type",
        label: "What type of concrete work?",
        type: "select",
        options: [
          "Driveway",
          "Patio",
          "Sidewalk",
          "Foundation",
          "Other",
        ],
        required: true,
      },
      {
        key: "thickness",
        label: "Preferred thickness?",
        type: "select",
        options: ['4 inches (standard)', '6 inches (heavy duty)', "Not sure"],
        required: true,
      },
      {
        key: "reinforcement",
        label: "Reinforcement preference?",
        type: "select",
        options: ["Rebar", "Wire Mesh", "Not sure"],
        required: false,
      },
      {
        key: "finish",
        label: "Desired finish?",
        type: "select",
        options: ["Broom (standard)", "Stamped", "Exposed Aggregate", "Polished"],
        required: false,
      },
      {
        key: "needs_demo",
        label: "Is there existing concrete to remove?",
        type: "select",
        options: ["Yes", "No"],
        required: true,
      },
      {
        key: "additional_notes",
        label: "Anything else we should know?",
        type: "textarea",
        required: false,
      },
    ],
  },
  message_templates: [
    {
      channel: "sms",
      name: "quote_sent",
      body: "Hi {{name}}! Your concrete quote from {{company}} is ready. View it here: {{quote_link}}",
      variables: ["name", "company", "quote_link"],
    },
    {
      channel: "email",
      name: "quote_sent",
      body: "Hi {{name}},\n\nYour custom concrete quote is ready! Click below to view your options:\n\n{{quote_link}}\n\nQuestions? Reply to this email.\n\nBest,\n{{company}}",
      variables: ["name", "company", "quote_link"],
    },
    {
      channel: "sms",
      name: "followup_1",
      body: "Hey {{name}}, following up on your concrete quote. Ready to get started? {{quote_link}}",
      variables: ["name", "quote_link"],
    },
    {
      channel: "sms",
      name: "booking_confirmed",
      body: "{{name}}, your concrete job is confirmed for {{date}}. We'll be there at {{time}}. - {{company}}",
      variables: ["name", "date", "time", "company"],
    },
  ],
  followup_rules: [
    {
      trigger: "quote_sent",
      steps: [
        { delay_hours: 24, channel: "sms", template_name: "followup_1" },
        { delay_hours: 72, channel: "email", template_name: "quote_sent" },
      ],
    },
  ],
  slot_strategy: {
    duration_minutes: 480,
    lead_time_hours: 72,
    buffer_minutes: 0,
    max_per_day: 1,
    working_hours: { start: 7, end: 17 },
  },
};

export const SEED_TEMPLATES = [
  { name: "FenceTemplate_v1", niche: "fencing", template_json: FENCE_TEMPLATE },
  { name: "RoofTemplate_v1", niche: "roofing", template_json: ROOF_TEMPLATE },
  { name: "ConcreteTemplate_v1", niche: "concrete", template_json: CONCRETE_TEMPLATE },
];
