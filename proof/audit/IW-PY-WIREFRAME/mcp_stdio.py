"""Actual JSON-RPC stdio child, owned fixtures/output only; no HTTP listener."""
import hashlib
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time

ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'proof/audit/IW-PY-WIREFRAME'
DEST=OUT/'mcp-stdio-attempt-05';DEST.mkdir(exist_ok=False)
env={**os.environ,'PYTHONPATH':os.pathsep.join([str(OUT/'python-deps'),str(ROOT/'engine/python'),str(ROOT/'engine')]),'PYTHONDONTWRITEBYTECODE':'1','PYTHONIOENCODING':'utf-8'}
bootstrap="import site,runpy,faulthandler;site.addsitedir("+repr(str(OUT/'mcp-deps'))+");faulthandler.dump_traceback_later(10);runpy.run_module('server.mcp_server',run_name='__main__')"
command=[sys.executable,'-u','-c',bootstrap]
process=subprocess.Popen(command,cwd=ROOT,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
responses=queue.Queue();raw_output=[];raw_errors=[]
def reader(stream,sink,forward=False):
    total=0
    for line in iter(stream.readline,b''):
        total+=len(line)
        if total>16*1024*1024: responses.put(RuntimeError('Output bound exceeded'));return
        sink.append(line)
        if forward: responses.put(json.loads(line))
threading.Thread(target=reader,args=(process.stdout,raw_output,True),daemon=True).start()
threading.Thread(target=reader,args=(process.stderr,raw_errors),daemon=True).start()
rows=[];counter=0
def call(method,params):
    global counter
    counter+=1;request={'jsonrpc':'2.0','id':counter,'method':method,'params':params}
    process.stdin.write((json.dumps(request)+'\n').encode());process.stdin.flush()
    started=time.monotonic();deadline=started+40
    while time.monotonic()<deadline:
        response=responses.get(timeout=max(.01,deadline-time.monotonic()))
        if isinstance(response,Exception):raise response
        if response.get('id')==counter:
            (DEST/f'{counter:02d}.response.json').write_text(json.dumps(response,indent=2),encoding='utf-8')
            row={'id':counter,'method':method,'params':params,'elapsedSeconds':round(time.monotonic()-started,3),'responseBytes':len(json.dumps(response).encode()),'error':response.get('error'),'isError':response.get('result',{}).get('isError',False)}
            rows.append(row);print(json.dumps(row),flush=True);return response
    raise TimeoutError('MCP response timed out')
try:
    call('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'owned-wireframe-audit','version':'1'}})
    process.stdin.write(b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n');process.stdin.flush()
    listed=call('tools/list',{})
    assert {t['name'] for t in listed['result']['tools']}=={'engine_info','run_takeoff','quote_draft','run_takeoff_calibrated','marked_pdf','wireframe_scene'}
    def tool(name,arguments):return call('tools/call',{'name':name,'arguments':arguments})
    assert not tool('wireframe_scene',{'pdf_path':str(OUT/'synthetic-nested-plan.dxf'),'height':8})['result'].get('isError')
    shed=str(ROOT/'engine/fixtures/shed-manners-aline.pdf');electrical=str(ROOT/'engine/fixtures/electrical-schedule.pdf')
    assert not tool('engine_info',{})['result'].get('isError')
    assert not tool('run_takeoff',{'pdf_path':shed})['result'].get('isError')
    assert not tool('quote_draft',{'pdf_path':electrical})['result'].get('isError')
    tool('run_takeoff_calibrated',{'pdf_path':shed,'page':0,'p0':[0,0],'p1':[100,0],'known_mm':1000})
    assert tool('run_takeoff_calibrated',{'pdf_path':shed,'page':0,'p0':[0,0],'p1':[0,0],'known_mm':-1})['result'].get('isError')
    target=DEST/'marked.pdf';target.write_bytes(b'owned overwrite probe')
    assert tool('marked_pdf',{'pdf_path':electrical,'out_path':str(target)})['result'].get('isError')
    rows.append({'probe':'existing-output-overwritten','observed':target.read_bytes()!=b'owned overwrite probe','outputSha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    assert not tool('marked_pdf',{'pdf_path':electrical,'out_path':str(DEST/'fresh-marked.pdf')})['result'].get('isError')
    assert tool('wireframe_scene',{'pdf_path':shed})['result'].get('isError')
    import ezdxf
    cad=ezdxf.readfile(OUT/'synthetic-nested-plan.dxf')
    refs=list(cad.modelspace().query('INSERT'))
    for entity in refs[1:]:cad.modelspace().delete_entity(entity)
    small=DEST/'small-native-plan.dxf';cad.saveas(small)
    assert not tool('wireframe_scene',{'pdf_path':str(small),'height':8})['result'].get('isError')
    tool('not_registered',{})
finally:
    process.stdin.close()
    try:process.wait(timeout=5)
    except subprocess.TimeoutExpired:process.terminate();process.wait(timeout=5)
    (DEST/'stdout.jsonl').write_bytes(b''.join(raw_output));(DEST/'stderr.log').write_bytes(b''.join(raw_errors))
    (DEST/'summary.json').write_text(json.dumps({'command':command,'exitCode':process.returncode,'calls':rows},indent=2),encoding='utf-8')
