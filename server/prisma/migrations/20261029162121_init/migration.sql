BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] VARCHAR(30) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(255),
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Role_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Permission] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] VARCHAR(60) NOT NULL,
    [name] NVARCHAR(150) NOT NULL,
    [module] VARCHAR(30) NOT NULL,
    CONSTRAINT [Permission_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Permission_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[RolePermission] (
    [roleId] INT NOT NULL,
    [permissionId] INT NOT NULL,
    CONSTRAINT [RolePermission_pkey] PRIMARY KEY CLUSTERED ([roleId],[permissionId])
);

-- CreateTable
CREATE TABLE [dbo].[Account] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] VARCHAR(100) NOT NULL,
    [passwordHash] VARCHAR(255) NOT NULL,
    [roleId] INT NOT NULL,
    [status] VARCHAR(20) NOT NULL CONSTRAINT [Account_status_df] DEFAULT 'ACTIVE',
    [lastLogin] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Account_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Account_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Account_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Otp] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] VARCHAR(100) NOT NULL,
    [codeHash] VARCHAR(255) NOT NULL,
    [purpose] VARCHAR(30) NOT NULL CONSTRAINT [Otp_purpose_df] DEFAULT 'RESET_PASSWORD',
    [attempts] INT NOT NULL CONSTRAINT [Otp_attempts_df] DEFAULT 0,
    [expiresAt] DATETIME2 NOT NULL,
    [usedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Otp_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Otp_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Customer] (
    [id] INT NOT NULL IDENTITY(1,1),
    [accountId] INT NOT NULL,
    [fullName] NVARCHAR(100) NOT NULL,
    [phone] VARCHAR(15),
    [gender] VARCHAR(10),
    [birthday] DATE,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Customer_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Customer_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Customer_accountId_key] UNIQUE NONCLUSTERED ([accountId])
);

-- CreateTable
CREATE TABLE [dbo].[Address] (
    [id] INT NOT NULL IDENTITY(1,1),
    [customerId] INT NOT NULL,
    [receiverName] NVARCHAR(100) NOT NULL,
    [phone] VARCHAR(15) NOT NULL,
    [line] NVARCHAR(255) NOT NULL,
    [ward] NVARCHAR(100) NOT NULL,
    [district] NVARCHAR(100) NOT NULL,
    [province] NVARCHAR(100) NOT NULL,
    [isDefault] BIT NOT NULL CONSTRAINT [Address_isDefault_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Address_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Address_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Category] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [slug] VARCHAR(120) NOT NULL,
    [description] NVARCHAR(255),
    [imageUrl] VARCHAR(500),
    [parentId] INT,
    [sortOrder] INT NOT NULL CONSTRAINT [Category_sortOrder_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [Category_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Category_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Category_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Category_name_key] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [Category_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[Brand] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [slug] VARCHAR(120) NOT NULL,
    [description] NVARCHAR(255),
    [logoUrl] VARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [Brand_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Brand_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Brand_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Brand_name_key] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [Brand_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[League] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [slug] VARCHAR(120) NOT NULL,
    [country] NVARCHAR(50),
    [type] VARCHAR(20) NOT NULL CONSTRAINT [League_type_df] DEFAULT 'CLUB',
    [logoUrl] VARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [League_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [League_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [League_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [League_name_key] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [League_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[Team] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [slug] VARCHAR(120) NOT NULL,
    [shortName] VARCHAR(10),
    [type] VARCHAR(20) NOT NULL CONSTRAINT [Team_type_df] DEFAULT 'CLUB',
    [country] NVARCHAR(50),
    [leagueId] INT,
    [logoUrl] VARCHAR(500),
    [primaryColor] VARCHAR(7) NOT NULL CONSTRAINT [Team_primaryColor_df] DEFAULT '#0B1220',
    [secondaryColor] VARCHAR(7) NOT NULL CONSTRAINT [Team_secondaryColor_df] DEFAULT '#FFFFFF',
    [kitPattern] VARCHAR(20) NOT NULL CONSTRAINT [Team_kitPattern_df] DEFAULT 'PLAIN',
    [isFeatured] BIT NOT NULL CONSTRAINT [Team_isFeatured_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [Team_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Team_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Team_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Team_name_key] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [Team_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[ProductType] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [slug] VARCHAR(120) NOT NULL,
    [description] NVARCHAR(255),
    [isActive] BIT NOT NULL CONSTRAINT [ProductType_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProductType_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ProductType_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ProductType_name_key] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [ProductType_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[Size] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] VARCHAR(10) NOT NULL,
    [sizeType] VARCHAR(10) NOT NULL CONSTRAINT [Size_sizeType_df] DEFAULT 'ADULT',
    [sortOrder] INT NOT NULL CONSTRAINT [Size_sortOrder_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [Size_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Size_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Size_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Size_name_sizeType_key] UNIQUE NONCLUSTERED ([name],[sizeType])
);

-- CreateTable
CREATE TABLE [dbo].[Color] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(50) NOT NULL,
    [hex] VARCHAR(7) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [Color_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Color_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Color_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Color_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[Product] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(150) NOT NULL,
    [slug] VARCHAR(180) NOT NULL,
    [categoryId] INT NOT NULL,
    [brandId] INT,
    [teamId] INT,
    [productTypeId] INT,
    [season] VARCHAR(20),
    [playerName] NVARCHAR(100),
    [playerNumber] INT,
    [gender] VARCHAR(10),
    [material] NVARCHAR(100),
    [description] NVARCHAR(max),
    [basePrice] DECIMAL(12,0) NOT NULL,
    [salePrice] DECIMAL(12,0),
    [status] VARCHAR(20) NOT NULL CONSTRAINT [Product_status_df] DEFAULT 'DRAFT',
    [isFeatured] BIT NOT NULL CONSTRAINT [Product_isFeatured_df] DEFAULT 0,
    [soldCount] INT NOT NULL CONSTRAINT [Product_soldCount_df] DEFAULT 0,
    [ratingAvg] FLOAT(53) NOT NULL CONSTRAINT [Product_ratingAvg_df] DEFAULT 0,
    [ratingCount] INT NOT NULL CONSTRAINT [Product_ratingCount_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Product_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Product_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Product_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[ProductImage] (
    [id] INT NOT NULL IDENTITY(1,1),
    [productId] INT NOT NULL,
    [url] VARCHAR(500) NOT NULL,
    [alt] NVARCHAR(150),
    [colorId] INT,
    [sortOrder] INT NOT NULL CONSTRAINT [ProductImage_sortOrder_df] DEFAULT 0,
    [isPrimary] BIT NOT NULL CONSTRAINT [ProductImage_isPrimary_df] DEFAULT 0,
    CONSTRAINT [ProductImage_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ProductVariant] (
    [id] INT NOT NULL IDENTITY(1,1),
    [productId] INT NOT NULL,
    [sizeId] INT NOT NULL,
    [colorId] INT NOT NULL,
    [sku] VARCHAR(60) NOT NULL,
    [price] DECIMAL(12,0),
    [stockQuantity] INT NOT NULL CONSTRAINT [ProductVariant_stockQuantity_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [ProductVariant_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProductVariant_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ProductVariant_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ProductVariant_sku_key] UNIQUE NONCLUSTERED ([sku]),
    CONSTRAINT [ProductVariant_productId_sizeId_colorId_key] UNIQUE NONCLUSTERED ([productId],[sizeId],[colorId])
);

-- CreateTable
CREATE TABLE [dbo].[Cart] (
    [id] INT NOT NULL IDENTITY(1,1),
    [customerId] INT NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Cart_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Cart_customerId_key] UNIQUE NONCLUSTERED ([customerId])
);

-- CreateTable
CREATE TABLE [dbo].[CartItem] (
    [id] INT NOT NULL IDENTITY(1,1),
    [cartId] INT NOT NULL,
    [variantId] INT NOT NULL,
    [quantity] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CartItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CartItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CartItem_cartId_variantId_key] UNIQUE NONCLUSTERED ([cartId],[variantId])
);

-- CreateTable
CREATE TABLE [dbo].[Order] (
    [id] INT NOT NULL IDENTITY(1,1),
    [orderCode] VARCHAR(20) NOT NULL,
    [customerId] INT NOT NULL,
    [status] VARCHAR(20) NOT NULL CONSTRAINT [Order_status_df] DEFAULT 'PENDING',
    [paymentStatus] VARCHAR(20) NOT NULL CONSTRAINT [Order_paymentStatus_df] DEFAULT 'PENDING',
    [paymentMethod] VARCHAR(20) NOT NULL,
    [subtotal] DECIMAL(12,0) NOT NULL,
    [discountAmount] DECIMAL(12,0) NOT NULL CONSTRAINT [Order_discountAmount_df] DEFAULT 0,
    [shippingFee] DECIMAL(12,0) NOT NULL CONSTRAINT [Order_shippingFee_df] DEFAULT 0,
    [total] DECIMAL(12,0) NOT NULL,
    [voucherId] INT,
    [voucherCode] VARCHAR(30),
    [receiverName] NVARCHAR(100) NOT NULL,
    [receiverPhone] VARCHAR(15) NOT NULL,
    [shippingAddress] NVARCHAR(500) NOT NULL,
    [note] NVARCHAR(500),
    [cancelReason] NVARCHAR(255),
    [cancelledAt] DATETIME2,
    [deliveredAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Order_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Order_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Order_orderCode_key] UNIQUE NONCLUSTERED ([orderCode])
);

-- CreateTable
CREATE TABLE [dbo].[OrderDetail] (
    [id] INT NOT NULL IDENTITY(1,1),
    [orderId] INT NOT NULL,
    [variantId] INT NOT NULL,
    [productId] INT NOT NULL,
    [productName] NVARCHAR(150) NOT NULL,
    [sizeName] VARCHAR(10) NOT NULL,
    [colorName] NVARCHAR(50) NOT NULL,
    [imageUrl] VARCHAR(500),
    [unitPrice] DECIMAL(12,0) NOT NULL,
    [quantity] INT NOT NULL,
    [lineTotal] DECIMAL(12,0) NOT NULL,
    CONSTRAINT [OrderDetail_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[OrderStatusHistory] (
    [id] INT NOT NULL IDENTITY(1,1),
    [orderId] INT NOT NULL,
    [fromStatus] VARCHAR(20),
    [toStatus] VARCHAR(20) NOT NULL,
    [note] NVARCHAR(255),
    [changedById] INT,
    [changedAt] DATETIME2 NOT NULL CONSTRAINT [OrderStatusHistory_changedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [OrderStatusHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Payment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [orderId] INT NOT NULL,
    [method] VARCHAR(20) NOT NULL,
    [amount] DECIMAL(12,0) NOT NULL,
    [status] VARCHAR(20) NOT NULL CONSTRAINT [Payment_status_df] DEFAULT 'PENDING',
    [transactionRef] VARCHAR(100),
    [paidAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Payment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Payment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Promotion] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(150) NOT NULL,
    [slug] VARCHAR(180) NOT NULL,
    [description] NVARCHAR(500),
    [bannerUrl] VARCHAR(500),
    [discountType] VARCHAR(10) NOT NULL,
    [discountValue] DECIMAL(12,0) NOT NULL,
    [scope] VARCHAR(20) NOT NULL CONSTRAINT [Promotion_scope_df] DEFAULT 'ALL',
    [categoryId] INT,
    [teamId] INT,
    [productId] INT,
    [startAt] DATETIME2 NOT NULL,
    [endAt] DATETIME2 NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [Promotion_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Promotion_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Promotion_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Promotion_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[Voucher] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] VARCHAR(30) NOT NULL,
    [description] NVARCHAR(255),
    [discountType] VARCHAR(10) NOT NULL,
    [discountValue] DECIMAL(12,0) NOT NULL,
    [maxDiscount] DECIMAL(12,0),
    [minOrderValue] DECIMAL(12,0) NOT NULL CONSTRAINT [Voucher_minOrderValue_df] DEFAULT 0,
    [usageLimit] INT,
    [usedCount] INT NOT NULL CONSTRAINT [Voucher_usedCount_df] DEFAULT 0,
    [perUserLimit] INT,
    [scope] VARCHAR(20) NOT NULL CONSTRAINT [Voucher_scope_df] DEFAULT 'ALL',
    [categoryId] INT,
    [productId] INT,
    [startAt] DATETIME2 NOT NULL,
    [endAt] DATETIME2 NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [Voucher_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Voucher_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Voucher_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Voucher_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Review] (
    [id] INT NOT NULL IDENTITY(1,1),
    [customerId] INT NOT NULL,
    [productId] INT NOT NULL,
    [orderId] INT NOT NULL,
    [rating] INT NOT NULL,
    [content] NVARCHAR(1000),
    [images] NVARCHAR(max),
    [isHidden] BIT NOT NULL CONSTRAINT [Review_isHidden_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Review_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Review_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Review_customerId_productId_orderId_key] UNIQUE NONCLUSTERED ([customerId],[productId],[orderId])
);

-- CreateTable
CREATE TABLE [dbo].[NewsCategory] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [slug] VARCHAR(120) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [NewsCategory_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [NewsCategory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [NewsCategory_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [NewsCategory_name_key] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [NewsCategory_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[News] (
    [id] INT NOT NULL IDENTITY(1,1),
    [title] NVARCHAR(200) NOT NULL,
    [slug] VARCHAR(220) NOT NULL,
    [summary] NVARCHAR(500),
    [content] NVARCHAR(max) NOT NULL,
    [thumbnailUrl] VARCHAR(500),
    [status] VARCHAR(20) NOT NULL CONSTRAINT [News_status_df] DEFAULT 'DRAFT',
    [publishedAt] DATETIME2,
    [authorId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [News_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [News_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [News_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[NewsOnCategory] (
    [newsId] INT NOT NULL,
    [categoryId] INT NOT NULL,
    CONSTRAINT [NewsOnCategory_pkey] PRIMARY KEY CLUSTERED ([newsId],[categoryId])
);

-- CreateTable
CREATE TABLE [dbo].[SystemSetting] (
    [id] INT NOT NULL IDENTITY(1,1),
    [storeName] NVARCHAR(100) NOT NULL CONSTRAINT [SystemSetting_storeName_df] DEFAULT 'JERSEY',
    [storeEmail] VARCHAR(100),
    [storePhone] VARCHAR(15),
    [storeAddress] NVARCHAR(255),
    [currency] VARCHAR(10) NOT NULL CONSTRAINT [SystemSetting_currency_df] DEFAULT 'VND',
    [shippingFee] DECIMAL(12,0) NOT NULL CONSTRAINT [SystemSetting_shippingFee_df] DEFAULT 30000,
    [freeShipThreshold] DECIMAL(12,0) NOT NULL CONSTRAINT [SystemSetting_freeShipThreshold_df] DEFAULT 500000,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SystemSetting_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Account_roleId_idx] ON [dbo].[Account]([roleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Otp_email_purpose_idx] ON [dbo].[Otp]([email], [purpose]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Customer_phone_idx] ON [dbo].[Customer]([phone]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Address_customerId_idx] ON [dbo].[Address]([customerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Team_leagueId_idx] ON [dbo].[Team]([leagueId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_categoryId_idx] ON [dbo].[Product]([categoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_brandId_idx] ON [dbo].[Product]([brandId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_teamId_idx] ON [dbo].[Product]([teamId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_status_idx] ON [dbo].[Product]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProductImage_productId_idx] ON [dbo].[ProductImage]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_customerId_idx] ON [dbo].[Order]([customerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_status_idx] ON [dbo].[Order]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_createdAt_idx] ON [dbo].[Order]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderDetail_orderId_idx] ON [dbo].[OrderDetail]([orderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderStatusHistory_orderId_idx] ON [dbo].[OrderStatusHistory]([orderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payment_orderId_idx] ON [dbo].[Payment]([orderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Review_productId_idx] ON [dbo].[Review]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [News_status_publishedAt_idx] ON [dbo].[News]([status], [publishedAt]);

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_permissionId_fkey] FOREIGN KEY ([permissionId]) REFERENCES [dbo].[Permission]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Account] ADD CONSTRAINT [Account_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Customer] ADD CONSTRAINT [Customer_accountId_fkey] FOREIGN KEY ([accountId]) REFERENCES [dbo].[Account]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Address] ADD CONSTRAINT [Address_customerId_fkey] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customer]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Category] ADD CONSTRAINT [Category_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Team] ADD CONSTRAINT [Team_leagueId_fkey] FOREIGN KEY ([leagueId]) REFERENCES [dbo].[League]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_brandId_fkey] FOREIGN KEY ([brandId]) REFERENCES [dbo].[Brand]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_teamId_fkey] FOREIGN KEY ([teamId]) REFERENCES [dbo].[Team]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_productTypeId_fkey] FOREIGN KEY ([productTypeId]) REFERENCES [dbo].[ProductType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProductImage] ADD CONSTRAINT [ProductImage_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProductImage] ADD CONSTRAINT [ProductImage_colorId_fkey] FOREIGN KEY ([colorId]) REFERENCES [dbo].[Color]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProductVariant] ADD CONSTRAINT [ProductVariant_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProductVariant] ADD CONSTRAINT [ProductVariant_sizeId_fkey] FOREIGN KEY ([sizeId]) REFERENCES [dbo].[Size]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProductVariant] ADD CONSTRAINT [ProductVariant_colorId_fkey] FOREIGN KEY ([colorId]) REFERENCES [dbo].[Color]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Cart] ADD CONSTRAINT [Cart_customerId_fkey] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customer]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CartItem] ADD CONSTRAINT [CartItem_cartId_fkey] FOREIGN KEY ([cartId]) REFERENCES [dbo].[Cart]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CartItem] ADD CONSTRAINT [CartItem_variantId_fkey] FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [Order_customerId_fkey] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customer]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [Order_voucherId_fkey] FOREIGN KEY ([voucherId]) REFERENCES [dbo].[Voucher]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderDetail] ADD CONSTRAINT [OrderDetail_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderDetail] ADD CONSTRAINT [OrderDetail_variantId_fkey] FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderDetail] ADD CONSTRAINT [OrderDetail_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderStatusHistory] ADD CONSTRAINT [OrderStatusHistory_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Promotion] ADD CONSTRAINT [Promotion_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Promotion] ADD CONSTRAINT [Promotion_teamId_fkey] FOREIGN KEY ([teamId]) REFERENCES [dbo].[Team]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Promotion] ADD CONSTRAINT [Promotion_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Voucher] ADD CONSTRAINT [Voucher_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Voucher] ADD CONSTRAINT [Voucher_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Review] ADD CONSTRAINT [Review_customerId_fkey] FOREIGN KEY ([customerId]) REFERENCES [dbo].[Customer]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Review] ADD CONSTRAINT [Review_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Review] ADD CONSTRAINT [Review_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[News] ADD CONSTRAINT [News_authorId_fkey] FOREIGN KEY ([authorId]) REFERENCES [dbo].[Account]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[NewsOnCategory] ADD CONSTRAINT [NewsOnCategory_newsId_fkey] FOREIGN KEY ([newsId]) REFERENCES [dbo].[News]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[NewsOnCategory] ADD CONSTRAINT [NewsOnCategory_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[NewsCategory]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
