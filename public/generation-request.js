function isUgcStyle(styleId) {
  return String(styleId || "").startsWith("ugc-");
}

export function resolveGenerationRouting({
  selectedStyleId,
  userPickedStyle,
  workflowType,
  routeDecision,
  selectedContentTypeId
} = {}) {
  const manualWorkflowType = workflowType || "slideshow";
  const keepManualWorkflow =
    !!userPickedStyle || (isUgcStyle(selectedStyleId) && manualWorkflowType.startsWith("ugc-"));
  const routedWorkflowType = routeDecision?.workflowType;
  const routedContentTypeId = routeDecision?.contentTypeId;

  const resolvedWorkflowType = keepManualWorkflow
    ? manualWorkflowType
    : (routedWorkflowType || manualWorkflowType);

  const workflowOverride =
    keepManualWorkflow && routedWorkflowType && routedWorkflowType !== manualWorkflowType
      ? manualWorkflowType
      : undefined;

  const contentTypeOverride =
    routedContentTypeId && selectedContentTypeId && selectedContentTypeId !== routedContentTypeId
      ? selectedContentTypeId
      : undefined;

  return {
    workflowType: resolvedWorkflowType,
    deliveryTargets: routeDecision?.deliveryTargets,
    contentTypeId: routedContentTypeId || selectedContentTypeId || undefined,
    routingOverride: workflowOverride || contentTypeOverride
      ? {
          ...(workflowOverride ? { workflowType: workflowOverride } : {}),
          ...(contentTypeOverride ? { contentTypeId: contentTypeOverride } : {})
        }
      : undefined,
    includeUgcBrief: isUgcStyle(selectedStyleId) && manualWorkflowType.startsWith("ugc-")
  };
}
