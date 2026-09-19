import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  EXPERIENCE_BAND_LABEL,
  type ExperienceBand,
  type JobFilters,
} from "@/lib/jobs/explorer-types";
import { parseSalaryInputValue, salaryValueToInputText } from "@/lib/jobs/salary-input";
import { WORK_MODE_LABEL, type WorkMode } from "@/lib/domain";

/** How long to wait after the user stops typing in a salary field before
 * applying it as a filter. Long enough to cover a normal typing burst
 * (e.g. "50000"), short enough that the list still feels responsive. */
const SALARY_COMMIT_DEBOUNCE_MS = 500;

const selectClass =
  "border-input bg-transparent dark:bg-white/[0.04] text-foreground h-9 w-full rounded-lg border px-3 text-sm";

export function JobFiltersPanel({
  filters,
  locationInput,
  onLocationInputChange,
  onSubmitSearch,
  onChange,
  onClear,
  careers,
  skills,
}: {
  filters: JobFilters;
  /** Pending (not-yet-submitted) location text, lifted up so the parent can
   * submit it together with the keyword search in a single request. */
  locationInput: string;
  onLocationInputChange: (value: string) => void;
  /** Submits the pending keyword + location text together. Never called
   * automatically while typing — only from Enter here or the Search button
   * in the parent. */
  onSubmitSearch: () => void;
  onChange: (next: JobFilters) => void;
  onClear: () => void;
  careers: { id: string; title: string }[];
  skills: { id: string; name: string }[];
}) {
  const [skillQuery, setSkillQuery] = useState("");
  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    if (!q) return skills.slice(0, 40);
    return skills.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 40);
  }, [skillQuery, skills]);

  function set<K extends keyof JobFilters>(key: K, value: JobFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  // `set` closes over the current `filters`/`onChange` each render, so a
  // ref keeps the debounced salary commit below from firing against a
  // stale copy of either if something else changes filters in the
  // meantime (e.g. the user also picks a different career).
  const setRef = useRef(set);
  setRef.current = set;

  // The salary inputs keep their own text while the user types (see
  // salary-input.ts for why) instead of round-tripping every keystroke
  // straight through `onChange` -> URL navigation -> back down as
  // `filters.salaryMin`/`salaryMax`. That round trip is what previously
  // made typing "50000" render through "5", "50", "500", "5000" before
  // settling: each keystroke triggered its own navigation, and the
  // controlled input's value snapped back to whatever had committed so
  // far on every intermediate render.
  const [salaryMinInput, setSalaryMinInput] = useState(() =>
    salaryValueToInputText(filters.salaryMin),
  );
  const [salaryMaxInput, setSalaryMaxInput] = useState(() =>
    salaryValueToInputText(filters.salaryMax),
  );
  const salaryMinDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salaryMaxDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync local text when the applied filter changes from outside this
  // panel (clearing filters, browser back/forward) — but not on every
  // render, so it never fights with what the user is actively typing.
  useEffect(() => {
    setSalaryMinInput(salaryValueToInputText(filters.salaryMin));
    if (salaryMinDebounceRef.current) clearTimeout(salaryMinDebounceRef.current);
  }, [filters.salaryMin]);
  useEffect(() => {
    setSalaryMaxInput(salaryValueToInputText(filters.salaryMax));
    if (salaryMaxDebounceRef.current) clearTimeout(salaryMaxDebounceRef.current);
  }, [filters.salaryMax]);

  useEffect(() => {
    return () => {
      if (salaryMinDebounceRef.current) clearTimeout(salaryMinDebounceRef.current);
      if (salaryMaxDebounceRef.current) clearTimeout(salaryMaxDebounceRef.current);
    };
  }, []);

  function handleSalaryMinInput(text: string) {
    setSalaryMinInput(text);
    if (salaryMinDebounceRef.current) clearTimeout(salaryMinDebounceRef.current);
    const parsed = parseSalaryInputValue(text);
    salaryMinDebounceRef.current = setTimeout(() => {
      setRef.current("salaryMin", parsed);
    }, SALARY_COMMIT_DEBOUNCE_MS);
  }

  function handleSalaryMaxInput(text: string) {
    setSalaryMaxInput(text);
    if (salaryMaxDebounceRef.current) clearTimeout(salaryMaxDebounceRef.current);
    const parsed = parseSalaryInputValue(text);
    salaryMaxDebounceRef.current = setTimeout(() => {
      setRef.current("salaryMax", parsed);
    }, SALARY_COMMIT_DEBOUNCE_MS);
  }

  function commitSalaryMinNow() {
    if (salaryMinDebounceRef.current) clearTimeout(salaryMinDebounceRef.current);
    setRef.current("salaryMin", parseSalaryInputValue(salaryMinInput));
  }

  function commitSalaryMaxNow() {
    if (salaryMaxDebounceRef.current) clearTimeout(salaryMaxDebounceRef.current);
    setRef.current("salaryMax", parseSalaryInputValue(salaryMaxInput));
  }

  function toggleSkill(skillId: string) {
    const has = filters.skillIds.includes(skillId);
    set(
      "skillIds",
      has ? filters.skillIds.filter((id) => id !== skillId) : [...filters.skillIds, skillId],
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="filter-career">Career</Label>
        <select
          id="filter-career"
          className={selectClass}
          value={filters.careerId ?? ""}
          onChange={(e) => set("careerId", e.target.value || null)}
        >
          <option className="bg-popover text-popover-foreground" value="">
            All careers
          </option>
          {careers.map((c) => (
            <option className="bg-popover text-popover-foreground" key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-location">Location</Label>
        <Input
          id="filter-location"
          placeholder="City, country, or Remote"
          value={locationInput}
          onChange={(e) => onLocationInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmitSearch();
            }
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-workmode">Work mode</Label>
        <select
          id="filter-workmode"
          className={selectClass}
          value={filters.workMode}
          onChange={(e) => set("workMode", e.target.value as WorkMode | "any")}
        >
          <option className="bg-popover text-popover-foreground" value="any">
            Any
          </option>
          {(["remote", "hybrid", "onsite"] as WorkMode[]).map((mode) => (
            <option className="bg-popover text-popover-foreground" key={mode} value={mode}>
              {WORK_MODE_LABEL[mode]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-salary-min">Salary</Label>
        <div className="flex items-center gap-2">
          <Input
            id="filter-salary-min"
            type="number"
            min={0}
            placeholder="Min"
            aria-label="Minimum salary"
            value={salaryMinInput}
            onChange={(e) => handleSalaryMinInput(e.target.value)}
            onBlur={commitSalaryMinNow}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitSalaryMinNow();
              }
            }}
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            aria-label="Maximum salary"
            value={salaryMaxInput}
            onChange={(e) => handleSalaryMaxInput(e.target.value)}
            onBlur={commitSalaryMaxNow}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitSalaryMaxNow();
              }
            }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-experience">Experience</Label>
        <select
          id="filter-experience"
          className={selectClass}
          value={filters.experience ?? ""}
          onChange={(e) => set("experience", (e.target.value || null) as ExperienceBand | null)}
        >
          <option className="bg-popover text-popover-foreground" value="">
            Any
          </option>
          {(Object.keys(EXPERIENCE_BAND_LABEL) as ExperienceBand[]).map((band) => (
            <option className="bg-popover text-popover-foreground" key={band} value={band}>
              {EXPERIENCE_BAND_LABEL[band]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-skills">Skills</Label>
        <Input
          id="filter-skills"
          placeholder="Search skills…"
          value={skillQuery}
          onChange={(e) => setSkillQuery(e.target.value)}
        />
        <div className="border-border/70 mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-lg border p-2">
          {filteredSkills.length === 0 && (
            <p className="text-muted-foreground px-1 py-2 text-xs">No skills match.</p>
          )}
          {filteredSkills.map((skill) => (
            <label
              key={skill.id}
              htmlFor={`skill-filter-${skill.id}`}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
            >
              <Checkbox
                id={`skill-filter-${skill.id}`}
                checked={filters.skillIds.includes(skill.id)}
                onCheckedChange={() => toggleSkill(skill.id)}
              />
              {skill.name}
            </label>
          ))}
        </div>
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
