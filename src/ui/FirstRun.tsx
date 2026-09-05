import { Panel } from "./kit";
import type { Prefs } from "../lib/prefs";

/**
 * First launch on a device: the dataset lives in this browser only, so the operator
 * chooses between the demo yard (to learn the flow) and an empty plant record.
 */
export function FirstRun({ onChoose }: { onChoose: (choice: NonNullable<Prefs["started"]>) => void }) {
  return (
    <div className="firstrun">
      <div className="firstrun-card">
        <h1>កសិករទំនើប · ប្រព័ន្ធគ្រប់គ្រងផលិតកម្មជី</h1>
        <p className="panel-hint">
          ប្រព័ន្ធគ្រប់គ្រងផលិតកម្មជីកំប៉ុស្តិ៍៖ ស្តុកវត្ថុធាតុដើម → រូបមន្ត → Lot → ការតាមដាន
          → គុណភាព → ស្លាក QR → អតិថិជន និងរបាយការណ៍ ថ្លៃដើម/គីឡូ។
        </p>
        <p className="panel-hint">
          ជ្រើសទិន្នន័យដើម្បីចាប់ផ្តើម។ ទាំងអស់ត្រូវបានរក្សានៅលើ<b>ឧបករណ៍នេះតែមួយ</b> —
          ចុច «ទាញយក JSON» នៅផ្ទាំង ទិន្នន័យ/ការកំណត់ ជាប្រចាំ ដើម្បីកុំបាត់បង់។
        </p>
        <div className="firstrun-actions">
          <button type="button" className="firstrun-choice" onClick={() => onChoose("demo")}>
            <b>មើលជាមួយទិន្នន័យគំរូ</b>
            <span>
              របៀង ៦ ជួរ · Lot 13 · រូបមន្ត ៣ · អតិថិជន ៤ ។ ល្អសម្រាប់សិក្សាលំហូរការងារ
              មុនកត់អ្វីពិត។
            </span>
          </button>
          <button type="button" className="firstrun-choice" onClick={() => onChoose("blank")}>
            <b>ចាប់ផ្តើមទិន្នន័យរបស់ខ្ញុំ</b>
            <span>
              ទីតាំងទទេ។ ចាប់ពី ស្តុកវត្ថុធាតុដើម និង រូបមន្ត ជាមុន រួចបើក Lot ទី១។
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sits in the settings screen so the choice is not lost after first launch. */
export function DatasetChoice({ db, onChoose }: { db: { lots: unknown[] }; onChoose: (c: NonNullable<Prefs["started"]>) => void }) {
  return (
    <Panel title="ទិន្នន័យដើមរបស់ឧបករណ៍នេះ" hint="ជ្រើសឡើងវិញបាន — ការប្តូរមិនលុបអ្វីទេលើកដំបូង">
      <div className="firstrun-actions">
        <button
          type="button"
          className="firstrun-choice"
          onClick={() => onChoose("demo")}
        >
          <b>ទិន្នន័យគំរូ</b>
          <span>ផ្ទុករបៀង/គំរូ ៧ ខែឡើងវិញ (ជំនួសទិន្នន័យបច្ចុប្បន្ន)</span>
        </button>
        <button type="button" className="firstrun-choice" onClick={() => onChoose("blank")}>
          <b>ទិន្នន័យទទេ</b>
          <span>
            {db.lots.length ? `សម្អាត ${db.lots.length} Lot និងគ្រប់ចលនាទាំងអស់` : "គ្មានទិន្នន័យត្រូវលុប"}
          </span>
        </button>
      </div>
    </Panel>
  );
}
