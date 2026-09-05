import sys,json
sys.path.insert(0,'engine')
from server.quote_lines import build_quote_draft
empty=build_quote_draft({})
assert empty['quote_lines']==[]
q={'id':'q1','trade':'electrical','item':'socket','qty':3,'unit':'ea','formula':'count verified evidence','tier':'needs-human','evidence':['e1']}
r=build_quote_draft({'quantities':[q]})
line=r['quote_lines'][0]
assert line['quantity']==3 and line['rate'] is None and line['amount'] is None and line['review_required'] is True
assert line['evidence_refs']==['e1']
print(json.dumps({'empty':empty,'populated':r}))
