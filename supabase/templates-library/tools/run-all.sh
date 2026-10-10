#!/usr/bin/env bash
# Run every converter on its downloaded inputs, writing drafts into <out>.
# Usage: run-all.sh <inputs root> <out dir>
#   <inputs root> holds one folder per source group (gate2026, ugcnet, upsc, csir, ssc, rrb, entr,
#   med, prof, cisce, intl, hard, hard/ncism), each with the pdftotext output the converter expects.
set -u
IN=$1; OUT=$2
TOOLS=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"
run() { # run <tool> <args...>
  local tool=$1; shift
  node "$TOOLS/$tool.mjs" "$@" >/dev/null 2>&1 || echo "FAILED $tool"
}
run gate_to_md "$IN/gate2026" "$OUT/gate"
run ugcnet_to_md "$IN/ugcnet" "$OUT/ugcnet"
run upsc_ese_to_md "$IN/upsc/ese.raw.txt" "$OUT/upsc"
run csir_net_to_md "$IN/csir" "$OUT/csir"
run ssc_je_to_md "$IN/ssc/je.txt" "$OUT/ssc"
run rrb_je_to_md "$IN/rrb/je.txt" "$IN/rrb/ann.txt" "$OUT/rrb"
run bank_to_md "$OUT/bank"
run aptitude_to_md "$OUT/aptitude"
run entrance_to_md "$IN/entr" "$OUT/entrance"
run med_to_md "$IN/med" "$OUT/med"
run cs_cma_to_md "$IN/prof" "$OUT/prof"
run cisce_to_md "$IN/cisce" "$OUT/cisce"
run intl_to_md "$IN/intl" "$OUT/intl"
run enem_to_md "$IN/hard/enem.txt" "$OUT/enem.md"
run aiapget_to_md "$IN/hard/ncism" "$OUT/aiapget-ayurveda.md"
run bhms_to_md "$IN/hard/bhms.txt" "$OUT/aiapget-homoeopathy.md"
