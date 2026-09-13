import { useState } from 'react';
import { IndustryDraftHost } from './IndustryDraftHost';
import { RoofingDraftPanel } from './roofing/RoofingDraftPanel';
import { roofFormSchema, createEmptyRoofForm } from './roofing/roofForm';
import { HvacDraftPanel } from './hvac/HvacDraftPanel';
import { ductFormSchema, createEmptyDuctForm } from './hvac/ductForm';
import { QuantityDraftPanel } from './quantity-surveying/QuantityDraftPanel';
import { quantityFormSchema, createEmptyQuantityForm } from './quantity-surveying/quantityForm';
import type { IndustryDraftId } from './draftStorage';
import './industryDrafts.css';

export function IndustryDraftWorkbench({ projectId }: { projectId: string }) {
  const [industry, setIndustry] = useState<IndustryDraftId>('roofing');
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
      {industry === 'roofing' && <IndustryDraftHost key={`${projectId}:roofing`} projectId={projectId} industry="roofing" schema={roofFormSchema} createEmpty={createEmptyRoofForm} Panel={RoofingDraftPanel} />}
      {industry === 'hvac' && <IndustryDraftHost key={`${projectId}:hvac`} projectId={projectId} industry="hvac" schema={ductFormSchema} createEmpty={createEmptyDuctForm} Panel={HvacDraftPanel} />}
      {industry === 'quantity-surveying' && <IndustryDraftHost key={`${projectId}:quantity-surveying`} projectId={projectId} industry="quantity-surveying" schema={quantityFormSchema} createEmpty={createEmptyQuantityForm} Panel={QuantityDraftPanel} />}
    </div>
  </details>;
}
