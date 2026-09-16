import { useMemo, useState } from 'react';
import { IndustryDraftHost } from './IndustryDraftHost';
import { RoofingDraftPanel } from './roofing/RoofingDraftPanel';
import { roofFormSchema, createEmptyRoofForm } from './roofing/roofForm';
import { HvacDraftPanel } from './hvac/HvacDraftPanel';
import { ductFormSchema, createEmptyDuctForm } from './hvac/ductForm';
import { QuantityDraftPanel } from './quantity-surveying/QuantityDraftPanel';
import { quantityFormSchema, createEmptyQuantityForm } from './quantity-surveying/quantityForm';
import { industrySourceRecordsFrom } from './sourceBinding.ts';
import type { IndustryDraftId } from './draftStorage';
import './industryDrafts.css';

export type IndustryDraftWorkbenchProps = {
  projectId: string;
  documents: { id: string; name?: string; sha256: string | null }[];
  activeDocumentId: string | null;
  activeSheet: number;
  calibrations: {
    sheet: number;
    locked: boolean;
    source: string;
    metresPerUnit: number;
    selectedCandidateId: string | null;
  }[];
};

export function IndustryDraftWorkbench({ projectId, documents, activeDocumentId, activeSheet, calibrations }: IndustryDraftWorkbenchProps) {
  const [industry, setIndustry] = useState<IndustryDraftId>('roofing');
  const records = useMemo(
    () => industrySourceRecordsFrom({ projectId, documents, activeDocumentId, activeSheet, calibrations }),
    [projectId, documents, activeDocumentId, activeSheet, calibrations],
  );
  return <details className="industry-workbench">
    <summary>Industry worksheets <span>Roofing, duct material and quantity classification</span></summary>
    <div className="industry-workbench-body">
      <label className="industry-picker">Worksheet
        <select value={industry} onChange={event => setIndustry(event.target.value as IndustryDraftId)}>
          <option value="roofing">Roofing areas</option>
          <option value="hvac">HVAC duct material</option>
          <option value="quantity-surveying">Quantity classification</option>
        </select>
      </label>
      {industry === 'roofing' && <IndustryDraftHost key={`${projectId}:roofing`} projectId={projectId} industry="roofing" schema={roofFormSchema} createEmpty={createEmptyRoofForm} Panel={RoofingDraftPanel} {...records} />}
      {industry === 'hvac' && <IndustryDraftHost key={`${projectId}:hvac`} projectId={projectId} industry="hvac" schema={ductFormSchema} createEmpty={createEmptyDuctForm} Panel={HvacDraftPanel} {...records} />}
      {industry === 'quantity-surveying' && <IndustryDraftHost key={`${projectId}:quantity-surveying`} projectId={projectId} industry="quantity-surveying" schema={quantityFormSchema} createEmpty={createEmptyQuantityForm} Panel={QuantityDraftPanel} {...records} />}
    </div>
  </details>;
}
