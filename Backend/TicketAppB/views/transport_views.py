import logging
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import BusType, Stage, Route, VehicleType, RouteStage, RouteBusType, Fare
from ..serializers import BusTypeSerializer, StageSerializer, RouteSerializer, VehicleTypeSerializer
from .utils import _get_authenticated_company_admin, _get_object_or_404


logger = logging.getLogger(__name__)


# ── Bus Type ──────────────────────────────────────────────────────────────────

@api_view(['GET'])
def get_bus_types(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    bus_types = BusType.objects.filter(company=company).order_by('id')
    serializer = BusTypeSerializer(bus_types, many=True)
    return Response({'message': 'Success', 'data': serializer.data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_bus_type(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    serializer = BusTypeSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(company=company, created_by=user)
        return Response({'message': 'Bus type created successfully', 'data': serializer.data}, status=status.HTTP_201_CREATED)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
def update_bus_type(request, pk):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    obj, err = _get_object_or_404(BusType, pk, company)
    if err:
        return err

    serializer = BusTypeSerializer(obj, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save(updated_by=user)
        return Response({'message': 'Bus type updated successfully', 'data': serializer.data}, status=status.HTTP_200_OK)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


# ── Stage ─────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def get_stages(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    show_deleted = request.query_params.get('show_deleted', 'false').lower() == 'true'
    qs = Stage.objects.filter(company=company)
    if not show_deleted:
        qs = qs.filter(is_deleted=False)

    qs = qs.order_by('id')
    serializer = StageSerializer(qs, many=True)
    return Response({'message': 'Success', 'data': serializer.data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_stage(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    serializer = StageSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(company=company, created_by=user)
        return Response({'message': 'Stage created successfully', 'data': serializer.data}, status=status.HTTP_201_CREATED)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
def update_stage(request, pk):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    obj, err = _get_object_or_404(Stage, pk, company)
    if err:
        return err

    serializer = StageSerializer(obj, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save(updated_by=user)
        return Response({'message': 'Stage updated successfully', 'data': serializer.data}, status=status.HTTP_200_OK)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


# ── Route ─────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def get_routes(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    show_deleted = request.query_params.get('show_deleted', 'false').lower() == 'true'
    qs = Route.objects.filter(company=company)
    if not show_deleted:
        qs = qs.filter(is_deleted=False)

    qs = qs.select_related('bus_type').prefetch_related(
        'route_stages__stage',
        'route_bus_types__bus_type'
    ).order_by('id')

    serializer = RouteSerializer(qs, many=True)
    return Response({'message': 'Success', 'data': serializer.data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_route(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    serializer = RouteSerializer(data=request.data, context={'company': company})
    if serializer.is_valid():
        route = serializer.save(company=company, created_by=user)

        route_stages_data = request.data.get('route_stages', [])
        if route_stages_data:
            _save_route_stages(route, route_stages_data, company, user)

        allowed_bus_type_ids = request.data.get('allowed_bus_types', [])
        if allowed_bus_type_ids:
            _save_route_bus_types(route, allowed_bus_type_ids, company, user)

        route_with_nested = Route.objects.prefetch_related(
            'route_stages__stage',
            'route_bus_types__bus_type'
        ).get(pk=route.id)
        return_serializer = RouteSerializer(route_with_nested)

        return Response({'message': 'Route created successfully', 'data': return_serializer.data}, status=status.HTTP_201_CREATED)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
def update_route(request, pk):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    obj, err = _get_object_or_404(Route, pk, company)
    if err:
        return err

    serializer = RouteSerializer(obj, data=request.data, partial=True, context={'company': company})
    if serializer.is_valid():
        route = serializer.save(updated_by=user)

        if 'route_stages' in request.data:
            route_stages_data = request.data.get('route_stages', [])
            RouteStage.objects.filter(route=route).delete()
            if route_stages_data:
                _save_route_stages(route, route_stages_data, company, user)

        if 'allowed_bus_types' in request.data:
            allowed_bus_type_ids = request.data.get('allowed_bus_types', [])
            RouteBusType.objects.filter(route=route).delete()
            if allowed_bus_type_ids:
                _save_route_bus_types(route, allowed_bus_type_ids, company, user)

        route_with_nested = Route.objects.prefetch_related(
            'route_stages__stage',
            'route_bus_types__bus_type'
        ).get(pk=route.id)
        return_serializer = RouteSerializer(route_with_nested)

        return Response({'message': 'Route updated successfully', 'data': return_serializer.data}, status=status.HTTP_200_OK)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


def _save_route_stages(route, stages_data, company, user):
    stage_ids = [s['stage'] for s in stages_data if 'stage' in s]
    valid_stages = Stage.objects.filter(id__in=stage_ids, company=company).values_list('id', flat=True)
    valid_stage_set = set(valid_stages)

    route_stages_to_create = []
    for stage_data in stages_data:
        stage_id = stage_data.get('stage')
        if not stage_id or stage_id not in valid_stage_set:
            continue
        route_stages_to_create.append(
            RouteStage(
                route=route,
                stage_id=stage_id,
                sequence_no=stage_data.get('sequence_no', 0),
                distance=stage_data.get('distance', 0),
                stage_local_lang=stage_data.get('stage_local_lang', ''),
                company=company,
                created_by=user
            )
        )

    if route_stages_to_create:
        RouteStage.objects.bulk_create(route_stages_to_create)


def _save_route_bus_types(route, bus_type_ids, company, user):
    valid_bus_types = BusType.objects.filter(id__in=bus_type_ids, company=company).values_list('id', flat=True)
    valid_bus_type_set = set(valid_bus_types)

    route_bus_types_to_create = []
    for bus_type_id in bus_type_ids:
        if bus_type_id not in valid_bus_type_set:
            continue
        route_bus_types_to_create.append(
            RouteBusType(
                route=route,
                bus_type_id=bus_type_id,
                company=company,
                created_by=user
            )
        )

    if route_bus_types_to_create:
        RouteBusType.objects.bulk_create(route_bus_types_to_create)


# ── Vehicle ───────────────────────────────────────────────────────────────────

@api_view(['GET'])
def get_vehicles(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    show_deleted = request.query_params.get('show_deleted', 'false').lower() == 'true'
    qs = VehicleType.objects.filter(company=company)
    if not show_deleted:
        qs = qs.filter(is_deleted=False)

    qs = qs.select_related('bus_type').order_by('id')
    serializer = VehicleTypeSerializer(qs, many=True)
    return Response({'message': 'Success', 'data': serializer.data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_vehicle(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    serializer = VehicleTypeSerializer(data=request.data, context={'company': company})
    if serializer.is_valid():
        serializer.save(company=company, created_by=user)
        return Response({'message': 'Vehicle created successfully', 'data': serializer.data}, status=status.HTTP_201_CREATED)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
def update_vehicle(request, pk):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    obj, err = _get_object_or_404(VehicleType, pk, company)
    if err:
        return err

    serializer = VehicleTypeSerializer(obj, data=request.data, partial=True, context={'company': company})
    if serializer.is_valid():
        serializer.save(updated_by=user)
        return Response({'message': 'Vehicle updated successfully', 'data': serializer.data}, status=status.HTTP_200_OK)

    return Response({'message': 'Validation failed', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


# ── Dropdowns ─────────────────────────────────────────────────────────────────

@api_view(['GET'])
def get_bus_types_dropdown(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    data = list(
        BusType.objects.filter(company=company, is_active=True)
        .values('id', 'bustype_code', 'name')
        .order_by('name')
    )
    return Response({'message': 'Success', 'data': data}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_stages_dropdown(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    data = list(
        Stage.objects.filter(company=company, is_deleted=False)
        .values('id', 'stage_code', 'stage_name')
        .order_by('stage_name')
    )
    return Response({'message': 'Success', 'data': data}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_vehicles_dropdown(request):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    from ..models import CrewAssignment
    exclude_assigned = request.query_params.get('exclude_assigned', 'false').lower() == 'true'
    assignment_id = request.query_params.get('assignment_id')

    qs = VehicleType.objects.filter(company=company, is_deleted=False)
    if exclude_assigned:
        assigned_qs = CrewAssignment.objects.filter(company=company)
        if assignment_id and str(assignment_id).isdigit():
            assigned_qs = assigned_qs.exclude(id=int(assignment_id))
        assigned_vehicle_ids = assigned_qs.values_list('vehicle_id', flat=True)
        qs = qs.exclude(id__in=assigned_vehicle_ids)

    data = list(qs.values('id', 'bus_reg_num').order_by('bus_reg_num'))
    return Response({'message': 'Success', 'data': data}, status=status.HTTP_200_OK)


# ── Fare Editor ───────────────────────────────────────────────────────────────

@api_view(['GET'])
def get_fare_editor(request, route_id):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    route, err = _get_object_or_404(Route, route_id, company)
    if err:
        return err

    stages = route.route_stages.select_related('stage').order_by('sequence_no')
    stage_list = [{
        'sequence_no': rs.sequence_no,
        'stage_id': rs.stage.id,
        'stage_code': rs.stage.stage_code,
        'stage_name': rs.stage.stage_name,
    } for rs in stages]

    print(stages)
    print(stage_list)

    n_stages = len(stage_list)

    if n_stages == 0:
        return Response({
            'message': 'No stages defined for this route',
            'data': {
                'route': {'id': route.id, 'route_code': route.route_code, 'route_name': route.route_name, 'fare_type': route.fare_type},
                'stages': [],
                'fare_type_name': 'Table Fare' if route.fare_type == 1 else 'Graph Fare',
                'fare_list': [],
                'fare_matrix': [],
            }
        }, status=status.HTTP_200_OK)

    fares = Fare.objects.filter(route=route).order_by('row', 'col')
    print(fares)

    if route.fare_type == 1:
        fare_dict = {f.col: f.fare_amount for f in fares if f.row == 1}
        fare_list = [fare_dict.get(i + 1, 0) for i in range(n_stages)]
        return Response({
            'message': 'Success',
            'data': {
                'route': {'id': route.id, 'route_code': route.route_code, 'route_name': route.route_name, 'fare_type': route.fare_type},
                'stages': stage_list,
                'fare_type_name': 'Table Fare (Distance-Based)',
                'fare_list': fare_list,
            }
        }, status=status.HTTP_200_OK)

    else:
        fare_dict = {(f.row, f.col): f.fare_amount for f in fares}
        fare_matrix = []
        for row_idx in range(n_stages):
            row_data = []
            for col_idx in range(n_stages):
                fare_amount = fare_dict.get((row_idx + 1, col_idx + 1), 0)
                row_data.append(fare_amount)
            fare_matrix.append(row_data)
        return Response({
            'message': 'Success',
            'data': {
                'route': {'id': route.id, 'route_code': route.route_code, 'route_name': route.route_name, 'fare_type': route.fare_type},
                'stages': stage_list,
                'fare_type_name': 'Graph Fare (Point-to-Point)',
                'fare_matrix': fare_matrix,
            }
        }, status=status.HTTP_200_OK)


@api_view(['POST'])
def update_fare_table(request, route_id):
    user, company, err = _get_authenticated_company_admin(request)
    if err:
        return err

    route, err = _get_object_or_404(Route, route_id, company)
    if err:
        return err

    stages = route.route_stages.order_by('sequence_no')
    n_stages = stages.count()

    if n_stages == 0:
        return Response({'message': 'No stages defined for this route. Add stops before creating fares.'}, status=status.HTTP_400_BAD_REQUEST)

    Fare.objects.filter(route=route).delete()
    fares_to_create = []

    if route.fare_type == 1:
        fare_list = request.data.get('fare_list', [])
        if not fare_list or not isinstance(fare_list, list):
            return Response({'message': 'Invalid fare_list format. Expected 1D array.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(fare_list) != n_stages:
            return Response({'message': f'fare_list must have {n_stages} entries (number of stages).'}, status=status.HTTP_400_BAD_REQUEST)

        for col_idx, fare_amount in enumerate(fare_list):
            if fare_amount == 0:
                continue
            fares_to_create.append(
                Fare(route=route, row=1, col=col_idx + 1, fare_amount=int(fare_amount), route_name=route.route_name, company=company, created_by=user)
            )

    else:
        fare_matrix = request.data.get('fare_matrix', [])
        if not fare_matrix or not isinstance(fare_matrix, list):
            return Response({'message': 'Invalid fare_matrix format. Expected 2D array.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(fare_matrix) != n_stages:
            return Response({'message': f'fare_matrix must have {n_stages} rows.'}, status=status.HTTP_400_BAD_REQUEST)
        for i, row in enumerate(fare_matrix):
            if len(row) != n_stages:
                return Response({'message': f'Row {i} must have {n_stages} columns.'}, status=status.HTTP_400_BAD_REQUEST)

        for i, row in enumerate(fare_matrix):
            for j, fare_amount in enumerate(row):
                if fare_amount == 0:
                    continue
                fares_to_create.append(
                    Fare(route=route, row=i + 1, col=j + 1, fare_amount=int(fare_amount), route_name=route.route_name, company=company, created_by=user)
                )

    if fares_to_create:
        Fare.objects.bulk_create(fares_to_create)

    fare_type_name = 'Table Fare' if route.fare_type == 1 else 'Graph Fare'
    return Response({'message': f'{fare_type_name} updated successfully. {len(fares_to_create)} fare records created.'}, status=status.HTTP_200_OK)
