from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import secrets
from ..models import ETMDevice
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse

import os

# ---- etm initial data send ----
# ---- we need to add some sort of flag to the etmdevice so that we know which all fetched intial setup data.we can set its status active ----
# ---- another is checking if max device limit reached for a company of active devices. ----
@csrf_exempt
@api_view(['GET'])
def get_etm_intial_data(request):
    # to generate not so obvious(secrets module) random 4-digit value
    uniqueIdentifier = secrets.randbelow(exclusive_upper_bound=8999)
    serialNumber = request.GET.get('serialnumber')
    if not serialNumber:
        return Response({"message": "Serial number is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        etm_object = ETMDevice.objects.get(serial_number=serialNumber)
    except ETMDevice.DoesNotExist:
        return Response({"message": "Serial number is unmapped"}, status=status.HTTP_404_NOT_FOUND)

    # get company fk from ETMDevice table
    company_obj = etm_object.company
    
    # get company details from Company table
    customerCode = company_obj.company_id
    try:
        customerCode = int(customerCode)
    except ValueError:
        pass
    companyName = company_obj.company_name
    customerName = company_obj.contact_person

    # get device_type from ETMDevice table
    devicetype = etm_object.DeviceType.ETM
    
    licenseUrl = os.environ.get('LICENSE_SERVER_BASE_URL') or 'http://202.88.237.210:8093/LicenceMgmt/public/api'
    version = os.environ.get('ETM_VERSION')

    data = {
        "upiDeviceSerialNumber": serialNumber,
        "uniqueIdentifier": str(uniqueIdentifier),
        "customerCode": customerCode,
        "customerName": customerName if customerName else companyName,
        "cLicenseURL": licenseUrl,
        "versionDetails": version,
        "devicetype": devicetype,
        "company": companyName,
        "date": timezone.now().strftime("%d-%m-%Y %H:%M:%S")
    }

    return Response({"status": "success", "statusCode": status.HTTP_200_OK, "message": "Device Details Fetch Succesfully!", "data": data})


# ---- send etm version to apk ----
@api_view(["GET"])
def get_etm_device_version_for_apk(request):
    return "PVT_GEN_12"