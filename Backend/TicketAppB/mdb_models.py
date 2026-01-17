from django.db import models

# ----------------------
# Master Tables
# ----------------------

class BusType(models.Model):
    legacy_id = models.IntegerField(unique=True)  # BUSTYPE.id
    name = models.CharField(max_length=50)
    comments = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return self.name


class EmployeeType(models.Model):
    legacy_id = models.IntegerField(unique=True)  # EMPLOYEETYPE.EmployeeTypeId
    name = models.CharField(max_length=50)

    def __str__(self):
        return self.name


class Employee(models.Model):
    legacy_id = models.IntegerField(unique=True)  # CREW.EMPLOYEEID
    name = models.CharField(max_length=50)
    employee_type = models.ForeignKey(EmployeeType, on_delete=models.PROTECT)

    def __str__(self):
        return f"{self.name} ({self.employee_type.name})"


class Vehicle(models.Model):
    bus_no = models.CharField(max_length=50, unique=True)  # VEHICLETYPE.BUSNO
    bus_type = models.ForeignKey(BusType, on_delete=models.PROTECT, null=True, blank=True)

    def __str__(self):
        return self.bus_no


class Route(models.Model):
    route_code = models.CharField(max_length=50, unique=True)  # ROUTE.rutcode
    name = models.CharField(max_length=50)                     # ROUTE.rutname
    min_fare = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    bus_type = models.ForeignKey(BusType, on_delete=models.PROTECT, null=True, blank=True)

    def __str__(self):
        return self.route_code


class Stage(models.Model):
    legacy_number = models.IntegerField(unique=True)  # STAGE.Number
    route = models.ForeignKey(Route, on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    distance = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.route.route_code} - {self.name}"


class Device(models.Model):
    palm_id = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.palm_id


# ----------------------
# Core Business Tables
# ----------------------

class Trip(models.Model):
    legacy_trip_master_id = models.IntegerField(unique=True)  # TRIPMASTER.Tirp_Master_Id

    device = models.ForeignKey(Device, on_delete=models.PROTECT)
    route = models.ForeignKey(Route, on_delete=models.PROTECT)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT)

    schedule_no = models.IntegerField()
    trip_no = models.IntegerField()

    driver = models.ForeignKey(Employee, related_name="driver_trips",
                               on_delete=models.SET_NULL, null=True)
    conductor = models.ForeignKey(Employee, related_name="conductor_trips",
                                  on_delete=models.SET_NULL, null=True)
    cleaner = models.ForeignKey(Employee, related_name="cleaner_trips",
                                on_delete=models.SET_NULL, null=True, blank=True)

    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Trip {self.trip_no} ({self.route.route_code})"


class Ticket(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE)
    ticket_no = models.IntegerField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    from_stage = models.ForeignKey(Stage, related_name='+', on_delete=models.SET_NULL, null=True)
    to_stage = models.ForeignKey(Stage, related_name='+', on_delete=models.SET_NULL, null=True)

    ladies_count = models.IntegerField(default=0)
    senior_count = models.IntegerField(default=0)

    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return f"TKT {self.ticket_no} - {self.amount}"


class Expense(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE)
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=50, blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.code} - {self.amount}"


class InspectorCheck(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE)
    inspector_id = models.CharField(max_length=50)
    station_no = models.CharField(max_length=50)
    checked_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Inspector {self.inspector_id} ({self.trip})"


class OdometerLog(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE)
    start_reading = models.CharField(max_length=50)
    end_reading = models.CharField(max_length=50)

    def __str__(self):
        return f"Odometer {self.trip}"


class Waybill(models.Model):
    legacy_waybill_id = models.IntegerField()
    waybill_number = models.CharField(max_length=50)
    duty_date = models.DateField(null=True, blank=True)
    conductor_name = models.CharField(max_length=150)
    driver_name = models.CharField(max_length=150)
    bus_no = models.CharField(max_length=100)
    service_no = models.CharField(max_length=200)

    def __str__(self):
        return self.waybill_number


# ----------------------
# Configuration / Metadata
# ----------------------

class Setting(models.Model):
    user_pwd = models.CharField(max_length=50, blank=True, null=True)
    master_pwd = models.CharField(max_length=50, blank=True, null=True)
    half_per = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    con_per = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    phy_per = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    round_amt = models.DecimalField(max_digits=10, decimal_places=7, default=0)
    luggage_unit_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    main_display = models.CharField(max_length=18, blank=True, null=True)
    main_display2 = models.CharField(max_length=23, blank=True, null=True)
    header1 = models.CharField(max_length=32, blank=True, null=True)
    header2 = models.CharField(max_length=32, blank=True, null=True)
    header3 = models.CharField(max_length=32, blank=True, null=True)
    footer1 = models.CharField(max_length=32, blank=True, null=True)
    footer2 = models.CharField(max_length=32, blank=True, null=True)

    palmtec_id = models.CharField(max_length=8, blank=True, null=True)
    report_flag = models.IntegerField(default=0)
    stage_font_flag = models.BooleanField(default=False)
    tripsms = models.BooleanField(default=False)
    shsms = models.BooleanField(default=False)
    gprs_enable = models.BooleanField(default=False)

    currency = models.CharField(max_length=7, blank=True, null=True)

    ladies_ratio = models.FloatField(default=0)
    senior_ratio = models.FloatField(default=0)
    big_fond = models.FloatField(default=0)

    class Meta:
        verbose_name = "Setting"
        verbose_name_plural = "Settings"

    def __str__(self):
        return f"Settings for device {self.palmtec_id or 'N/A'}"


class LoginTable(models.Model):
    username = models.CharField(max_length=10)
    password = models.CharField(max_length=8)
    superuser = models.CharField(max_length=10, blank=True, null=True)
    super_password = models.CharField(max_length=8, blank=True, null=True)

    class Meta:
        verbose_name = "Login Table"
        verbose_name_plural = "Login Table"

    def __str__(self):
        return self.username


class Version(models.Model):
    version_no = models.CharField(max_length=50)

    class Meta:
        verbose_name = "Version"
        verbose_name_plural = "Versions"

    def __str__(self):
        return self.version_no
