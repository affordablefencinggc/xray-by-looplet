# App atlas

read_project_context precedes every row and is left out
of the columns below.

| Intent | Pane | Tools in order | Must be true first |
| --- | --- | --- | --- |
| Know where the project stands | overview | read_project_context | Recovery finished, hydrated |
| Learn what the app can hold | any | read_workbench_structure | Static reference, not fresh project-state readback |
| Move to another pane | any | navigate_workspace | No pending trace or calibration |
| Read the authored design | sketch | navigate_workspace, read_architect_design | Workspace mounted |
| Draw walls, openings, levels, slabs, roofs, footprint, extrude | sketch | read_architect_design, draw_architect_elements, save_project | Current revision; 200 operations a batch; user chose Sketch or Model mode |
| Move, re-parameterise or remove entities | sketch | read_architect_design, edit_architect_elements, save_project | IDs read this turn; openings stay in their wall |
| Undo one design change | sketch | read_architect_design, undo_architect_change | Session history present |
| Rename the design | sketch | read_architect_design, edit_architect_elements (rename-design) | Demonstration marker retained |
| Picture the 3D model | sketch, model | capture_workspace_image | Canvas visible, one frame rendered |
| Show the design in the 3D viewer | model | read_architect_design, show_design_in_model | No pending draft; parts labelled inferred |
| Return the viewer to the catalog | model | hide_designed_model | A designed scene is mounted |
| Animate the model being drawn | model | read_draftsman_status, control_draftsman | Model viewer loaded; it does not navigate |
| Summarise a reconstruction | model | read_source_building | Sample scenes stay sample |
| Illustrate the captured view | render | capture_workspace_image, generate_render_visualisation | Web only, never native |
| List source sheets | sheets | read_source_sheets | Sidecar storage present |
| Rename, archive or recover a sheet | sheets | read_source_sheets, manage_source_sheet | documentId and pageIndex from the read |
| Set the scale of a page | measure | read_takeoff_evidence, calibrate_source_sheet | Two points, the distance the user stated, their own evidence wording; not the sample; a locked page needs replaceLocked |
| Measure a length | measure | read_takeoff_evidence, trace_takeoff_run | Calibration locked; lengths read back, never computed |
| Approve or reject a measurement | review | read_takeoff_evidence, review_takeoff_item | Work packet authority gate blocks approval; reviewer/decision-owner names do not verify authority or unlock it |
| Delete a measured run | measure | read_takeoff_evidence, remove_takeoff_trace | Run revision current |
| See imported rates | cost | read_price_books | Price storage present |
| Import supplier rates | cost | read_price_books, import_price_book | CSV text and metadata from the user; library revision |
| Hand over a file | sketch, sheets | read_architect_design, export_design_file | One of dxf, ifc, drawing-pdf, material-pdf, sheet-register; no pending draft |
| Save the project | any | read_project_context, save_project | Main record only, not a copy |
| Take a full workspace backup | proof | read_project_context, capture_project_backup | Current revision; stays on device |

## Not available through tools
Importing a plan is UI-only. There is no quote or bill-of-materials tool. Backups are captured but
never restored or deleted. Trace vertices cannot be edited one by one and located items cannot be
placed. Rendering is web-only. Source identity, hashes and classes cannot be changed. Geometry
is authored through Sketch tools and displayed in Model with show_design_in_model.

## Large assistant attachments
Live assistant accepts files up to 500 MB each, 20 per selection. read_assistant_file lists persisted project files or retrieves a PDF page, image preview or bounded text excerpt with continuation offsets. Read attached evidence before conclusions; uninspected pages remain unknown. PDF/IFC/DXF attachments are references, not automatically calibrated plans or mounted BIM models.
