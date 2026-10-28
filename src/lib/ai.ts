import { skillPhrase } from "@/lib/catalog";
import type { AiNote, CheckId, CheckState, Project, Skill } from "@/lib/types";

/**
 * Mocked plain-language notes.
 *
 * The UI calls these functions instead of a chatbot. Each one returns a short
 * title and body. A later server-side swap can call https://api.x.ai/v1 with
 * XAI_API_KEY and keep this same return shape. Do not put that key in the browser.
 */

export function projectNote(project: Project): AiNote {
  return { title: "In short", body: project.summary };
}

export function proofTip(skill: Skill): AiNote {
  const tips: Record<Skill, string> = {
    building: "Add a photo of recent work, like a finished wall, roof, or room.",
    farming: "Add a photo of recent work, like a planted row, a harvest, or a pen.",
    cooking: "Add a photo of a meal you prepared, or the kitchen you work in.",
    "guest-house": "Add a photo of a room you set up, or a place you look after.",
    front: "Add a photo of you welcoming guests, if you are comfortable sharing one.",
    power: "Add a photo of a panel, a battery, or a finished install.",
    water: "Add a photo of a pump, a tank, or a finished tap.",
    internet: "Add a photo of a hub, a mast, or a room you set up.",
    teaching: "Add a photo of a classroom you worked on, if you are comfortable sharing one.",
    care: "Add a photo of a clinic room or a cold box you look after, if you are comfortable sharing one.",
  };
  return { title: "A photo helps", body: tips[skill] };
}

export function matchNote(input: {
  project: Project;
  skill: Skill;
  askedTown: string;
  askedParish: string;
  projectTown: string;
  projectParish: string;
}): AiNote {
  const work = skillPhrase(input.skill);
  if (input.project.townId && input.projectTown === input.askedTown && input.projectParish === input.askedParish) {
    return {
      title: "Why this fits",
      body: `They need ${work} in ${input.projectTown}, and that is the work you picked.`,
    };
  }
  if (input.projectParish === input.askedParish) {
    return {
      title: "Why this fits",
      body: `They need ${work} in ${input.projectTown}, which is also in ${input.projectParish}.`,
    };
  }
  return {
    title: "Why this fits",
    body: `They need ${work} in ${input.projectTown}, ${input.projectParish}.`,
  };
}

const checkLabels: Record<CheckId, Record<CheckState, string>> = {
  organizer: {
    yes: "Organizer checked",
    review: "Organizer in review",
    open: "Organizer not checked",
  },
  jtb: {
    yes: "Tourist licence",
    review: "Tourist licence in review",
    open: "Tourist licence still open",
  },
  "site-visit": {
    yes: "Site visit done",
    review: "Site visit in review",
    open: "Site visit still open",
  },
  "parish-letter": {
    yes: "Parish letter",
    review: "Parish letter in review",
    open: "Parish letter still open",
  },
  rada: {
    yes: "Farm papers",
    review: "Farm papers in review",
    open: "Farm papers still open",
  },
  "public-health": {
    yes: "Health check done",
    review: "Health check in review",
    open: "Health check still open",
  },
  engineer: {
    yes: "Engineer visit",
    review: "Engineer visit in review",
    open: "Engineer visit still open",
  },
  community: {
    yes: "Community letter",
    review: "Community letter in review",
    open: "Community letter still open",
  },
};

export function checkLabel(id: CheckId, state: CheckState): string {
  return checkLabels[id][state];
}

export function checkNote(id: CheckId, state: CheckState): AiNote | null {
  if (id === "jtb" && state === "yes") {
    return {
      title: "What a JTB licence means",
      body: "A JTB licence means the Jamaica Tourist Board has registered this place to host visitors. It is a public check that the lodging is allowed to operate.",
    };
  }
  if (id === "jtb") {
    return {
      title: "What a JTB licence means",
      body: "A JTB licence means the Jamaica Tourist Board has registered a place to host visitors. This project's licence is still being checked, so that step is not finished.",
    };
  }
  if (id === "rada" && state === "yes") {
    return {
      title: "What farm papers mean",
      body: "Farm papers mean this farm is registered with RADA, the Rural Agricultural Development Authority.",
    };
  }
  if (id === "rada") {
    return {
      title: "What farm papers mean",
      body: "Farm papers mean a farm is registered with RADA, the Rural Agricultural Development Authority. This project's papers are not finished yet.",
    };
  }
  if (id === "parish-letter" && state === "yes") {
    return {
      title: "What a parish letter means",
      body: "A parish letter means the parish council knows about this project.",
    };
  }
  if (id === "parish-letter") {
    return {
      title: "What a parish letter means",
      body: "A parish letter means the parish council knows about a project. This letter is not finished yet.",
    };
  }
  if (id === "public-health") {
    return {
      title: "What the health check means",
      body: "A public health check looks at food safety. For this dairy, that check is still open, so it is not finished.",
    };
  }
  if (id === "engineer") {
    return {
      title: "What an engineer visit means",
      body:
        state === "yes"
          ? "An engineer visit means someone who knows the work has looked at the site."
          : "An engineer visit means someone who knows the work looks at the site. This visit is not finished yet.",
    };
  }
  if (id === "community") {
    return {
      title: "What a community letter means",
      body:
        state === "yes"
          ? "A community letter means people who live there have said this project should go ahead."
          : "A community letter means people who live there say the project should go ahead. This letter is not finished yet.",
    };
  }
  return null;
}
