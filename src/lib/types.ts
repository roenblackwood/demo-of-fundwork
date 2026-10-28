export type Sector = "lodging" | "agriculture";

export type Skill =
  | "building"
  | "guest-house"
  | "farming"
  | "cooking"
  | "front";

export type CheckId =
  | "organizer"
  | "jtb"
  | "site-visit"
  | "parish-letter"
  | "rada"
  | "public-health";

export type CheckState = "yes" | "review" | "open";

export type WorkPreset = "day" | "few" | "week";

export type PathChoice = "investor" | "worker";

export type Town = {
  id: string;
  name: string;
};

export type Parish = {
  id: string;
  name: string;
  towns: Town[];
};

export type Check = {
  id: CheckId;
  state: CheckState;
};

export type User = {
  id: string;
  name: string;
  role: PathChoice;
  parishId: string;
  townId: string;
  verified: boolean;
  skill: Skill | null;
  extraSkills: Skill[];
  proofLabel: string | null;
  example: string;
};

export type Project = {
  id: string;
  name: string;
  parishId: string;
  townId: string;
  sector: Sector;
  summary: string;
  whatYouGet: string;
  goalJmd: number;
  committedJmd: number;
  workStarted: boolean;
  organizerName: string;
  needs: Skill[];
  checks: Check[];
};

export type CommitmentStatus = "pledged" | "accepted";

export type Commitment = {
  id: string;
  userId: string;
  projectId: string;
  amountJmd: number;
  status: CommitmentStatus;
  createdAt: string;
};

export type ContributionStatus = "logged" | "accepted";

export type Contribution = {
  id: string;
  userId: string;
  projectId: string;
  skill: Skill;
  preset: WorkPreset;
  status: ContributionStatus;
  createdAt: string;
};

export type Seed = {
  parishes: Parish[];
  users: User[];
  projects: Project[];
  commitments: Commitment[];
  contributions: Contribution[];
};

export type AiNote = {
  title: string;
  body: string;
};
