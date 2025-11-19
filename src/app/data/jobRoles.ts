export interface JobRole {
  required_skills: string[];
  description: string;
}

export interface JobCategory {
  [key: string]: JobRole;
}

export interface JobRoles {
  [key: string]: JobCategory;
}

export const JOB_ROLES: JobRoles = {
  "Office": {
    "President/Gen Manager": {
      required_skills: [
        "Leadership & Strategic Thinking",
        "Financial Acumen",
        "Decision‑making",
        "Touchlink System Familiarity",
        "Reference Verification"
      ],
      description: "Top executive overseeing all operations, strategy, finance and compliance. Verifiable resume references expected."
    },
    "Vice President/Finance": {
      required_skills: [
        "Financial Analysis & Reporting",
        "Budget Management",
        "Touchlink System Familiarity",
        "Experience (if heavy workload)",
        "Reference Verification"
      ],
      description: "Leads corporate finance, budgeting and reporting. Fresh graduates welcome for lighter roles; verifiable track record required."
    },
    "Sales Manager": {
      required_skills: [
        "Sales Strategy",
        "Client Relationship Management",
        "Market Knowledge",
        "Touchlink System Familiarity",
        "Experience if heavy workload"
      ],
      description: "Drives sales team performance using cutting‑edge practices; candidates must know job applied for and be results‑oriented."
    },
    "Senior Production": {
      required_skills: [
        "Production Oversight",
        "Process Improvement",
        "Physical Compliance (no visible tattoos, appropriate build)",
        "Touchlink System Familiarity",
        "Experience if required"
      ],
      description: "Senior role coordinating production operations, enforcing physical and procedural compliance, utilizing modern systems."
    },
    "Supervisor": {
      required_skills: [
        "Team Supervision",
        "Production Process Knowledge",
        "Touchlink System Familiarity",
        "Physical Compliance"
      ],
      description: "Leads small teams ensuring smooth operations and adherence to company rules and systems."
    },
    "Sales Coordinator": {
      required_skills: [
        "Order Coordination",
        "Client Communication",
        "Touchlink System Usage",
        "Accuracy in Documentation",
        "Verifiable Resume Information"
      ],
      description: "Supports sales operations through accurate coordination and client liaison, with strong administrative skills."
    },
    "Production Coordinator": {
      required_skills: [
        "Scheduling & Coordination",
        "Production Floor Rules Awareness",
        "Touchlink System Usage",
        "Physical Compliance"
      ],
      description: "Coordinates production tasks and schedules, enforcing rules and utilizing internal systems."
    },
    "Procurement & Supply": {
      required_skills: [
        "Procurement Processes",
        "Vendor Management",
        "Touchlink Familiarity",
        "Experience if heavy workload"
      ],
      description: "Handles supply chain and procurement duties using system tools; fresh grads acceptable for lighter work."
    },
    "Cashier/Invoicing": {
      required_skills: [
        "Invoice Preparation",
        "Cash Handling",
        "Touchlink System Usage",
        "Accuracy & Attention to Detail"
      ],
      description: "Manages invoicing and payment transactions through accurate system entries and financial discipline."
    },
    "Dispatch Personnel": {
      required_skills: [
        "Logistics Coordination",
        "Shipment Documentation",
        "Touchlink or Dispatch Software",
        "Physical Compliance"
      ],
      description: "Handles product dispatch logistics and documentation; enforces production‑floor rules where needed."
    },
    "HR Generalist": {
      required_skills: [
        "Recruitment & Onboarding",
        "Leave Form & Absence Policy",
        "Reference Verification",
        "Touchlink System Familiarity"
      ],
      description: "Handling HR processes including attendance, leave approvals (via supervisor), recruitment and record‑keeping."
    },
    "Accounting Staff": {
      required_skills: [
        "Finance & Accounting",
        "Invoice Tracking",
        "Touchlink System Usage",
        "Accuracy & Verifiable Resume"
      ],
      description: "Performs accounting functions like ledger tracking and invoicing, with strong detail orientation."
    },
    "Design & Development IT": {
      required_skills: [
        "Software/System Design",
        "IT Development Tools",
        "Touchlink Integration Experience",
        "Fresh Graduate Acceptable (with skill knowledge)"
      ],
      description: "Develops and maintains systems, including integration with Touchlink; open to junior candidates with relevant skills."
    }
  },
  "Production": {
    "Cutting": {
      required_skills: [
        "Machine Operation",
        "Production Floor Compliance",
        "Physically Fit",
        "Alertness & Focus"
      ],
      description: "Operates cutting machines on the production floor; must meet physical standards and maintain high focus."
    },
    "Extrusion": {
      required_skills: [
        "Extrusion Process Knowledge",
        "Floor Compliance Rules",
        "Physically Fit",
        "Focused and Diligent Work Attitude"
      ],
      description: "Runs extrusion processes consistently and safely, adhering to production rules and personal presentation standards."
    },
    "Printing": {
      required_skills: [
        "Printing Machine Operation",
        "Cutting‑edge Techniques",
        "Alertness & Professional Demeanor"
      ],
      description: "Operates advanced printing lines with precision while observing safety and presentation policies."
    },
    "Slitting": {
      required_skills: [
        "Slitting Equipment Handling",
        "Process Accuracy",
        "Physically Fit",
        "Focused Work Style"
      ],
      description: "Manages slitting operations, emphasizing accuracy and physical compliance on the shop floor."
    },
    "Delivery": {
      required_skills: [
        "Loading & Logistics",
        "Production Compliance Awareness",
        "Physically Fit",
        "Dependability"
      ],
      description: "Handles delivery logistics and loading, observes production rules, and maintains professional conduct."
    },
    "Maintenance": {
      required_skills: [
        "Equipment Maintenance & Repair",
        "Production Safety Standards",
        "Physically Fit",
        "Attention to Detail"
      ],
      description: "Performs preventive and corrective maintenance while ensuring compliance with floor policies and safety protocols."
    },
    "Manual": {
      required_skills: [
        "Manual Assembly & Labour",
        "Physically Fit",
        "Alertness & Focus",
        "Willingness to Learn"
      ],
      description: "Engages in manual tasks across production lines; hires passionate individuals who stay alert and compliant."
    },
    "Quality Assurance": {
      required_skills: [
        "Inspection & Testing",
        "Quality Standards Knowledge",
        "Production Floor Compliance",
        "Attention & Focus"
      ],
      description: "Ensures product quality through systematic inspection, maintaining strict adherence to safety and presentation policies."
    },
    "Supervisor": {
      required_skills: [
        "Team Leadership",
        "Production Processes",
        "Rule Enforcement (e.g. no cellphone, physical norms)",
        "Focus & Responsibility"
      ],
      description: "Supervises floor teams, enforces production rules and ensures disciplined, quality‑driven operations."
    },
    "Utility": {
      required_skills: [
        "Support Tasks Across Departments",
        "Physical Fitness",
        "Compliance with Production Rules",
        "Alertness & Versatility"
      ],
      description: "Undertakes general support duties, assisting various production functions while upholding compliance and attentiveness."
    },
    "Warehouse": {
      required_skills: [
        "Inventory & Stock Management",
        "Material Handling",
        "Production Floor Compliance",
        "Accuracy & Reliability"
      ],
      description: "Manages stock and warehouse operations, ensuring accuracy, compliance with production floor policies, and safe handling."
    }
  }
};