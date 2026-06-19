"""
core/pagination.py
------------------
Optional pagination that preserves backward compatibility.

By default, the API returns *all* results (no pagination), exactly as before.
Callers opt-in to pagination by passing ?page=<n> (or ?page_size=<n>) in the
query string.  This means zero changes are required on the frontend for existing
API consumers.
"""

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class OptionalPageNumberPagination(PageNumberPagination):
    """
    Pagination that is opt-in via query param.

    * No ?page query param  →  returns all results (backward-compatible).
    * ?page=1               →  paginated response with metadata.
    * ?page_size=50         →  override the page size for this request.

    Maximum page size is capped at 500 to protect the database.
    """

    page_size = 25
    page_size_query_param = 'page_size'
    page_query_param = 'page'
    max_page_size = 500

    def paginate_queryset(self, queryset, request, view=None):
        """Skip pagination when the caller does not request a specific page."""
        if self.page_query_param not in request.query_params:
            return None  # Signal to DRF: return full queryset without wrapping
        return super().paginate_queryset(queryset, request, view)

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data,
        })

    def get_paginated_response_schema(self, schema):
        return {
            'type': 'object',
            'properties': {
                'count': {'type': 'integer', 'example': 100},
                'next': {'type': 'string', 'nullable': True, 'format': 'uri'},
                'previous': {'type': 'string', 'nullable': True, 'format': 'uri'},
                'results': schema,
            },
        }
