'use strict';

/** In-memory latest AI diagnosis when Supabase is not configured (mock mode). */
let memLatestDiagnosis = null;

function setMemLatestDiagnosis(row) {
  memLatestDiagnosis = row;
}

function getMemLatestDiagnosis() {
  return memLatestDiagnosis;
}

module.exports = { setMemLatestDiagnosis, getMemLatestDiagnosis };
